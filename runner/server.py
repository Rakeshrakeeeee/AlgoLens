import json
import os
import re
import subprocess
import threading
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent
IMAGE = "algolens-python-runner:0.1"
JAVA_IMAGE = "algolens-java-runner:0.1"
PORT = int(os.environ.get("ALGOLENS_RUNNER_PORT", "8765"))
MAX_REQUEST_BYTES = 32 * 1024
MAX_OUTPUT_BYTES = 5 * 1024 * 1024
EXECUTION_TIMEOUT_SECONDS = 12
ALLOWED_ORIGINS = {
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:4174",
    "http://127.0.0.1:4174",
}
EXECUTION_LOCK = threading.BoundedSemaphore(1)


def read_limited(stream, limit, process):
    chunks = []
    total = 0
    while True:
        chunk = stream.read(8192)
        if not chunk:
            break
        total += len(chunk)
        if total > limit:
            process.kill()
            break
        chunks.append(chunk)
    return b"".join(chunks)


def ensure_image():
    exists = subprocess.run(
        ["docker", "image", "inspect", IMAGE],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        timeout=5,
        check=False,
    )
    if exists.returncode == 0:
        return
    build = subprocess.run(
        ["docker", "build", "--tag", IMAGE, str(ROOT / "container")],
        capture_output=True,
        timeout=180,
        check=False,
    )
    if build.returncode != 0:
        raise RuntimeError("Could not prepare the local Python sandbox image. Check Docker Desktop and try again.")


def ensure_java_image():
    exists = subprocess.run(
        ["docker", "image", "inspect", JAVA_IMAGE],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        timeout=5,
        check=False,
    )
    if exists.returncode == 0:
        return
    build = subprocess.run(
        ["docker", "build", "--tag", JAVA_IMAGE, "--file", str(ROOT / "java" / "Containerfile"), str(ROOT / "java")],
        capture_output=True,
        timeout=240,
        check=False,
    )
    if build.returncode != 0:
        raise RuntimeError("Could not prepare the local Java sandbox image. Check Docker Desktop and try again.")


def run_in_sandbox(request):
    language = request.get("language", "python")
    if language not in ("python", "java"):
        raise RuntimeError("This execution language is not supported by the local runner.")
    image = JAVA_IMAGE if language == "java" else IMAGE
    if language == "java":
        ensure_java_image()
    else:
        ensure_image()
    container_name = f"algolens-{uuid.uuid4().hex}"
    create_command = [
        "docker", "create",
        "--name", container_name,
        "--label", "algolens.managed=true",
        "--network", "none",
        "--cpus", "1",
        "--memory", "256m",
        "--memory-swap", "256m",
        "--pids-limit", "64",
        "--read-only",
        "--cap-drop", "ALL",
        "--security-opt", "no-new-privileges",
        "--tmpfs", "/tmp:rw,noexec,nosuid,nodev,size=16m",
        "--tmpfs", "/home/runner:rw,noexec,nosuid,nodev,size=16m",
        "--user", "65534:65534",
        "--interactive",
        image,
    ]
    container_id = None
    try:
        created = subprocess.run(create_command, capture_output=True, timeout=10, check=False)
        if created.returncode != 0:
            raise RuntimeError("Docker could not create the isolated execution container.")
        container_id = created.stdout.decode("ascii", errors="ignore").strip()
        if not re.fullmatch(r"[0-9a-f]{12,64}", container_id):
            raise RuntimeError("Docker returned an invalid container identifier.")

        process = subprocess.Popen(
            ["docker", "start", "--attach", "--interactive", container_id],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        request_bytes = json.dumps(request, ensure_ascii=True).encode("utf-8")
        if process.stdin is None or process.stdout is None or process.stderr is None:
            process.kill()
            raise RuntimeError("Could not open the isolated runner streams.")

        stdout_result = []
        stderr_result = []
        stdout_thread = threading.Thread(
            target=lambda: stdout_result.append(read_limited(process.stdout, MAX_OUTPUT_BYTES, process)),
            daemon=True,
        )
        stderr_thread = threading.Thread(
            target=lambda: stderr_result.append(read_limited(process.stderr, 64 * 1024, process)),
            daemon=True,
        )
        stdout_thread.start()
        stderr_thread.start()
        try:
            process.stdin.write(request_bytes)
            process.stdin.close()
            process.wait(timeout=EXECUTION_TIMEOUT_SECONDS)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=3)
            return {
                "status": "error",
                "error": {"type": "Timeout", "message": "Execution exceeded the 10-second time limit.", "line": None},
                "events": [],
                "stdout": "",
                "truncated": False,
            }
        finally:
            stdout_thread.join(timeout=3)
            stderr_thread.join(timeout=3)
            process.stdout.close()
            process.stderr.close()
        if process.returncode != 0 or not stdout_result:
            return {
                "status": "runner_error",
                "error": {"type": "SandboxError", "message": "The sandbox stopped before it could return a trace."},
            }
        try:
            response = json.loads(stdout_result[0].decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError, RecursionError):
            return {
                "status": "runner_error",
                "error": {"type": "SandboxError", "message": "The sandbox returned an invalid trace."},
            }
        return response
    finally:
        if container_id is not None:
            subprocess.run(
                ["docker", "rm", "--force", container_id],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=5,
                check=False,
            )


def cleanup_managed_containers():
    listed = subprocess.run(
        ["docker", "ps", "--all", "--quiet", "--filter", "label=algolens.managed=true"],
        capture_output=True,
        timeout=5,
        check=False,
    )
    if listed.returncode != 0:
        return
    for container_id in listed.stdout.decode("ascii", errors="ignore").splitlines():
        if re.fullmatch(r"[0-9a-f]{12,64}", container_id):
            subprocess.run(
                ["docker", "rm", "--force", container_id],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=5,
                check=False,
            )


class Handler(BaseHTTPRequestHandler):
    server_version = "AlgoLensLocalRunner/0.1"

    def _respond(self, status, body):
        encoded = json.dumps(body, ensure_ascii=True).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(encoded)

    def do_OPTIONS(self):
        self.send_error(405)

    def do_GET(self):
        if self.path == "/api/health":
            try:
                docker = subprocess.run(
                    ["docker", "info", "--format", "{{.ServerVersion}}"],
                    capture_output=True,
                    timeout=3,
                    check=False,
                )
            except (OSError, subprocess.SubprocessError):
                docker = None
            if docker is None or docker.returncode != 0:
                self._respond(503, {"status": "offline", "language": "python", "sandbox": "docker"})
                return
            self._respond(200, {"status": "ok", "languages": ["python", "java"], "sandbox": "docker"})
            return
        self.send_error(404)

    def do_POST(self):
        if self.path != "/api/trace":
            self.send_error(404)
            return
        if self.headers.get("Origin") not in ALLOWED_ORIGINS:
            self.send_error(403)
            return
        if self.headers.get("Content-Type", "").split(";", 1)[0].strip().lower() != "application/json":
            self.send_error(415)
            return
        try:
            content_length = int(self.headers.get("Content-Length", ""))
        except ValueError:
            self.send_error(400)
            return
        if content_length < 1 or content_length > MAX_REQUEST_BYTES:
            self.send_error(413)
            return
        try:
            request = json.loads(self.rfile.read(content_length))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self.send_error(400)
            return
        if not isinstance(request, dict):
            self.send_error(400)
            return
        if not EXECUTION_LOCK.acquire(blocking=False):
            self._respond(429, {"status": "runner_busy", "error": {"message": "A trace is already running. Try again shortly."}})
            return
        try:
            try:
                self._respond(200, run_in_sandbox(request))
            except (OSError, subprocess.SubprocessError, RuntimeError):
                self._respond(503, {
                    "status": "runner_unavailable",
                    "error": {"message": "Local execution is unavailable. Start Docker Desktop and retry."},
                })
        finally:
            EXECUTION_LOCK.release()

    def log_message(self, format_string, *args):
        if self.command != "POST":
            super().log_message(format_string, *args)


class LoopbackServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = False


if __name__ == "__main__":
    server = LoopbackServer(("127.0.0.1", PORT), Handler)
    print(f"AlgoLens local Python runner listening on http://127.0.0.1:{PORT}")
    try:
        cleanup_managed_containers()
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        cleanup_managed_containers()
