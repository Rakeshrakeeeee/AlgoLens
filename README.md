# AlgoLens

AlgoLens is a local-first algorithm learning visualizer. It now has two clearly separated modes:

- **Pattern simulator:** deterministic, hand-modelled traces for array, two-pointer, sorting, and binary-search examples. It does not execute the source code in this mode.
- **Code execution (beta):** discovers Python or Java methods in the pasted solution, lets the learner choose one, then runs it in a temporary, restricted Docker container and records runtime line, call, return, exception, local-variable, and reachable-object snapshots.

This is an execution-capable prototype, not a claim to run every LeetCode answer. Execution currently supports bounded Python 3.13 and Java 21 subsets, auto-detects ordinary method declarations, and invokes the selected method with JSON-compatible arguments. You do not need to write a `main` method; the sandbox supplies its own harness. JavaScript, C++, specialized LeetCode serialization, and complete runtime introspection are not implemented.

## Run on Windows

### Requirements

- Node.js and npm.
- Python 3.10 or newer available as `python`.
- Docker Desktop using its **Linux container** engine.
- Enough free disk space to download the pinned Python and Java base images on first build. The images are reused for later runs.

Docker Desktop uses a Linux VM (usually WSL2) on Windows. Keep Docker Desktop running while using code execution mode. If Docker is unavailable, pattern simulator mode still works; execution mode must not run code directly on Windows as a fallback.

### Start the app

Open two PowerShell terminals in this directory.

Terminal 1 — local runner:

```powershell
npm run runner
```

Terminal 2 — web interface:

```powershell
npm run dev
```

Open the Local URL printed by Vite, usually `http://localhost:5173/`. In the app, select **Code execution · Python + Java**, choose Python or Java, paste a `class Solution`, choose the detected method, enter its arguments as a JSON array, and select **Run and visualize**. You do not need a `main` method. Python also accepts a top-level function. Example Java:

```java
class Solution {
    public int maxSubArray(int[] nums) {
        int current = nums[0];
        int best = nums[0];
        for (int i = 1; i < nums.length; i++) {
            current = Math.max(nums[i], current + nums[i]);
            best = Math.max(best, current);
        }
        return best;
    }
}
```

Java method arguments:

```json
[[-2, 1, -3, 4]]
```

The Java harness calls `new Solution().maxSubArray(new int[]{-2, 1, -3, 4})` (using the declared Java parameter types). In the app, method names and parameter placeholders are detected from the pasted source; choose another detected method if needed. The execution view follows Java source lines, shows local-variable changes, and renders an array argument as indexed cells. Set **Expected result** to `6` for a direct comparison on this input.

Python example:

```python
class Solution:
    def maxSubArray(self, nums):
        current = best = nums[0]
        for value in nums[1:]:
            current = max(value, current + value)
            best = max(best, current)
        return best
```

Method arguments:

```json
[[-2, 1, -3, 4]]
```

The execution runner calls `Solution().maxSubArray([-2, 1, -3, 4])` and returns a runtime event trace and result. AlgoLens detects ordinary Python method/function declarations and lets the learner choose the method; it does not require a user-written program entry point.

The first run for each language builds its sandbox image from a pinned public base image. The build downloads the required image, so **the first image setup needs internet access**. Submitted source and input are sent only to the loopback runner and the local Docker engine; they are not sent to an AlgoLens-hosted service or included in the image build.

## How it works

1. **React + TypeScript UI** collects source, language, a detected method selection, and JSON method arguments. It displays source-line highlights, local variables, reachable objects, the return value, errors, and playback controls.
2. **Vite** serves the frontend and proxies same-origin `/api` requests to the runner on `127.0.0.1:8765`.
3. **Python loopback service** validates the request, permits only the local development/preview origins, allows one active run at a time, prepares the local runner image, creates a fresh container, and removes it after completion or failure.
4. **Language-specific Docker runner image** reads a JSON request from standard input. Python's tracing hook or Java's JDI debugger records line/call/return/exception events, source line numbers, frame IDs, local values, and bounded object-graph snapshots. It calls the selected `Solution` method and serializes the result.
5. **Playback UI** navigates the returned immutable event list. Stepping backward or forward never re-executes the solution.

### Sandbox and resource bounds

Each code run uses a new container with no network, no host-directory mounts, a read-only root filesystem, a non-root UID, dropped Linux capabilities, `no-new-privileges`, and bounded CPU, memory, processes, temporary storage, execution time, output, and trace size. Current limits are 1 CPU, 256 MB RAM, 64 processes, 10 seconds for Python / 8 seconds for Java, a 32 KB combined request, 64 KB of captured program output, 1,000 trace events, and 4 MB of trace data. The runner also blocks selected process/network/native-module imports.

These measures substantially reduce exposure, but Docker containers share a kernel and are **not a mathematical guarantee that arbitrary hostile code is harmless**. Keep Docker Desktop updated, do not disable its isolation, and do not use this prototype as a public multi-user code-hosting service. Code can still consume the allowed CPU and memory during a run.

AlgoLens does not save or log submitted source, inputs, or trace snapshots. Execution traces live in the browser session only. The loopback runner does not enable permissive CORS and rejects requests from non-local web origins.

## Technology stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript 6, Vite 7 |
| Pattern simulator | Typed, deterministic TypeScript trace engine |
| Local API/orchestrator | Python standard library HTTP server and subprocess API |
| Execution sandbox | Docker Desktop Linux containers, pinned Python 3.13 slim and Eclipse Temurin Java 21 JDK images |
| Runtime tracing | Python `sys.settrace`; Java Debug Interface (JDI) line stepping; bounded JSON snapshots |
| UI validation | Vitest; Python `unittest`; TypeScript production build |

The local runner intentionally has no third-party Python package dependencies.

## Supported execution subset and limitations

- Python 3.13 or Java 21, selected in the execution tab.
- Python: a `class Solution` with a no-argument constructor and a named instance method, or a named top-level function. Java: a `class Solution` with a no-argument constructor and a named method.
- Up to 32 positional arguments made of bounded JSON values: null, booleans, finite numbers, strings, arrays, and string-keyed objects.
- Java parameters support primitive/wrapper numeric values, booleans, chars, strings, arrays (including nested primitive arrays), `List`, `Map`, and `Object` for JSON-compatible values. The Java harness uses declared parameter types to convert input.
- Runtime events include Python or Java user-source line, function-call, return, and exception events. A selected event shows that frame's locals and a bounded snapshot of reachable built-in collections/arrays; Java user-object fields are shown when available.
- Array arguments can be inspected as indexed cells with changed values highlighted; string locals are shown character-by-character. Enter one test case's arguments and optional expected JSON result, then change them and rerun to compare additional cases.
- The optional expected-result check identifies whether the returned result matches the value entered for this test. It does not prove the algorithm is correct on all inputs or explain the cause of a mismatch.
- Ordinary Java public/protected methods and Python functions/methods are detected from source for selection. The selected method is called by the sandbox harness, so submissions do not need a user-written `main`. Detection is source-based and may not list unusual declarations; the method field remains editable as a fallback. LeetCode's specialized linked-list/tree/graph encodings, judge-provided helpers, interactive input, and automatic test-case parsing are not yet implemented.
- Python imports for native/process/network modules named in the runner policy are blocked; the container's network is disabled regardless. Java receives no network access inside the container.
- Python line events identify the next line about to execute, as defined by Python's tracing API. This is runtime instrumentation, not an AI explanation of algorithm intent.
- The execution panel adds deterministic plain-English notes from adjacent runtime snapshots. It reports captured local-value changes and recognizes only a narrow set of provably skipped empty-iterable/simple Java `for` loops; unsupported conditions get a neutral state description instead of an inferred diagnosis. It does not use an AI service or evaluate submitted source.
- Java is compiled with debug metadata and stepped with JDI. It reports line/call snapshots and compile/runtime errors; stepping granularity follows Java source lines rather than each expression on a line.
- Snapshot depth, event count, object sizes, source size, output, CPU, memory, and wall-clock time are bounded. If the trace is clipped, the UI labels it incomplete.
- JavaScript and C++ execution still require separate language runtimes, harnesses, instrumentation, diagnostics, and security test plans before being offered.
- “All LeetCode code” is not a realistic support guarantee. Language/library behavior, serialization, concurrency, native code, and runtime effects must be explicitly supported and tested.

## Development and verification

```powershell
npm test
npm run build
python -m unittest runner.container.test_trace -v
python -m unittest runner.test_java_integration -v
docker build --tag algolens-python-runner:0.1 .\runner\container
docker build --tag algolens-java-runner:0.1 --file .\runner\java\Containerfile .\runner\java
```

Check runner and sandbox availability:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8765/api/health
docker ps --all --filter "name=algolens-"
```

The health endpoint should return `status: ok` while Docker's engine is running. After a trace completes, the `algolens-*` container list should be empty. The runner also removes stale containers it created when the service is restarted.

## Work completed and decisions

- Preserved the original pattern simulator rather than silently replacing its modelled traces with a misleading execution claim.
- Added separate Python and Java execution beta modes, a local runner, disposable Docker isolation, runtime events, object/variable snapshots, return/error display, and trace playback.
- Added a loopback API, same-origin Vite proxy, bounded request/trace handling, pinned Python/Java runtime images, and automated trace tests.
- Added [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md) describing the longer-term local execution architecture, trace contract, language rollout, limits, and verification gates; updated the planning docs to match.

## Challenges encountered and how they were handled

1. **Recognizing an algorithm is not the same as executing code.** Pattern matching cannot truthfully visualize every LeetCode solution. The existing simulator remains explicit and separate; execution mode uses Python's runtime tracing hook or Java JDI line stepping.
2. **Arbitrary code must not run directly on the laptop host.** Docker Desktop was installed but its Linux engine was initially stopped. It was started and verified, and the runner now reports when Docker is unavailable instead of falling back to host execution.
3. **Tracing can consume resources or create huge snapshots.** Per-run container limits, bounded JSON inputs, event/heap/output caps, and explicit “trace incomplete” states limit costs and prevent a truncated trace from looking complete.
4. **Languages need different instrumentation strategies.** Python uses `sys.settrace`; Java uses the JDK's JDI stepping interface. We first compiled the debugger controller in the pinned Java image, then used container smoke tests to work through the JDI step-request lifecycle before verifying source lines, variables, errors, and cleanup. JavaScript and C++ still need their own adapters and verification gates.
5. **Trace correctness needs observable tests.** Python tests cover line/local capture, return values, exceptions with source lines, blocked imports, invalid nested arguments, output limits, and explicit trace truncation. Java tests cover primitive-array iteration and variable snapshots, generic lists, compile diagnostics, runtime exceptions, and container cleanup.

## Planning and architecture documents

- [scope.md](./scope.md) — product boundary and roadmap.
- [prd.md](./prd.md) — user goals and functional requirements.
- [spec.md](./spec.md) — current app/trace implementation contracts.
- [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md) — local execution architecture and future language rollout.
