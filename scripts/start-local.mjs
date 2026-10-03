import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { env } from "node:process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const children = new Map();
const spawnErrors = new Map();
const startupOutput = new Map();
let stopping = false;
let stopPromise;

function isRunning(child) {
  return child.exitCode === null && child.signalCode === null;
}

function canBind(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => {
      server.close(() => resolve(true));
    });
  });
}

async function choosePort(candidates, service) {
  for (const port of candidates) {
    if (await canBind(port)) return port;
  }
  throw new Error(`No available local ${service} port. Close another app using ports ${candidates.join(", ")} and retry.`);
}

function startChild(name, command, args, childEnv = env) {
  const child = spawn(command, args, {
    cwd: root,
    env: childEnv,
    stdio: ["inherit", "pipe", "pipe"],
    windowsHide: true,
  });
  children.set(name, child);
  startupOutput.set(name, "");
  child.stdout.on("data", (chunk) => {
    startupOutput.set(name, `${startupOutput.get(name)}${chunk.toString()}`.slice(-4_096));
    process.stdout.write(chunk);
  });
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  child.on("error", (cause) => spawnErrors.set(name, cause));
  child.on("exit", (code, signal) => {
    if (stopping) return;
    const reason = signal ? `signal ${signal}` : `exit code ${code}`;
    console.error(`\nAlgoLens ${name} stopped unexpectedly (${reason}).`);
    void stopChildren(1);
  });
  return child;
}

async function waitForOutput(child, name, text, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (startupOutput.get(name)?.includes(text)) return;
    if (spawnErrors.has(name)) {
      throw new Error(`Could not start the ${name}: ${spawnErrors.get(name).message}`);
    }
    if (!isRunning(child)) {
      const reason = child.signalCode ? `signal ${child.signalCode}` : `exit code ${child.exitCode}`;
      throw new Error(`The ${name} stopped before becoming ready (${reason}).`);
    }
    await delay(50);
  }
  throw new Error(`Timed out waiting for the ${name} to listen.`);
}

async function waitForHttp(url, name, child, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (spawnErrors.has(name)) {
      throw new Error(`Could not start the ${name}: ${spawnErrors.get(name).message}`);
    }
    if (!isRunning(child)) {
      const reason = child.signalCode ? `signal ${child.signalCode}` : `exit code ${child.exitCode}`;
      throw new Error(`The ${name} stopped before becoming ready (${reason}).`);
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(6_000) });
      await response.body?.cancel();
      return response;
    } catch {
      await delay(200);
    }
  }
  throw new Error(`Timed out waiting for ${name} at ${url}.`);
}

function waitForChildClose(child) {
  if (!isRunning(child)) return Promise.resolve();
  return new Promise((resolve) => child.once("close", resolve));
}

function stopChildren(exitCode = 0) {
  if (stopPromise) return stopPromise;
  stopping = true;
  process.exitCode = exitCode;
  stopPromise = (async () => {
    const active = [...children.values()].filter(isRunning);
    for (const child of active) child.kill("SIGINT");
    await Promise.race([
      Promise.all(active.map(waitForChildClose)),
      delay(2_500),
    ]);
    for (const child of active) {
      if (isRunning(child)) child.kill("SIGTERM");
    }
    await Promise.race([
      Promise.all(active.map(waitForChildClose)),
      delay(1_000),
    ]);
    for (const child of active) {
      if (isRunning(child)) child.kill("SIGKILL");
    }
  })();
  return stopPromise;
}

process.once("SIGINT", () => {
  console.log("\nStopping AlgoLens...");
  void stopChildren(0);
});
process.once("SIGTERM", () => void stopChildren(0));

async function main() {
  const runnerPort = await choosePort(
    Array.from({ length: 10 }, (_, index) => 8765 + index),
    "runner",
  );
  const webPort = await choosePort([5173, 5174], "web app");
  const localEnv = { ...env, ALGOLENS_RUNNER_PORT: String(runnerPort) };
  const python = env.PYTHON || "python";
  const runner = startChild("runner", python, ["-u", "runner/server.py"], localEnv);
  await waitForOutput(runner, "runner", "local Python runner listening");
  const healthUrl = `http://127.0.0.1:${runnerPort}/api/health`;
  const health = await waitForHttp(healthUrl, "runner", runner);
  if (health.status === 503) {
    console.warn("Docker is unavailable. Pattern simulation will work; code execution will stay disabled.");
  } else if (!health.ok) {
    throw new Error(`The local runner returned HTTP ${health.status} during its health check.`);
  }

  const viteCli = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
  const vite = startChild("web app", process.execPath, [
    viteCli,
    "--host", "127.0.0.1",
    "--port", String(webPort),
    "--strictPort",
  ], localEnv);
  const appResponse = await waitForHttp(`http://127.0.0.1:${webPort}/`, "web app", vite);
  if (!appResponse.ok) {
    throw new Error(`The web app returned HTTP ${appResponse.status} during startup.`);
  }
  console.log(`\nAlgoLens is ready at http://localhost:${webPort}/`);
  console.log(`Local runner health: ${healthUrl}`);
  console.log("Press Ctrl+C to stop the web app and runner.");
}

main().catch(async (cause) => {
  console.error(`\nCould not start AlgoLens: ${cause instanceof Error ? cause.message : String(cause)}`);
  await stopChildren(1);
});
