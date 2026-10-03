---
doc: spec
status: approved
---

# AlgoLens — Technical Spec

## How This Works, In Plain Language

AlgoLens has two different ways to learn from an algorithm. **Pattern simulation** runs a small, known example in the browser and labels it as a simulation; it never runs the pasted source. **Code execution** sends a supported method and its JSON inputs to a local Python service. That service asks Docker to run the method in a temporary, restricted container, then returns the real line, variable, and collection snapshots it observed.

The React screen keeps the returned steps and moves through them for playback; going backward does not run the method again. A local explanation helper describes captured value changes using those snapshots and the source line. It explains a skipped loop only when a small, explicit condition grammar and captured values prove the result. Otherwise it sticks to what the trace shows instead of guessing at the cause. No cloud AI is needed for this proof of concept.

This keeps the existing app and its safety boundary, while making the local startup flow easier. It is deliberately not a general Java/Python interpreter or a public code-hosting service.

## The Core Journey Through the System

Implements `prd.md > The Core Journey`.

1. **Choose a mode.** The React app opens the workbench. Pattern simulation stays in the browser; code execution shows its language and sandbox availability.
2. **Prepare a method run.** In code-execution mode, the learner pastes a supported Java or Python solution, selects a detected method, and enters its ordered arguments as JSON. The UI checks the request before sending it.
3. **Run actual supported code.** The browser sends `POST /api/trace` through Vite's same-origin proxy to the Python service bound to `127.0.0.1`. The service validates the request and creates a fresh Docker container with no network or host-directory mount.
4. **Capture evidence.** The Python tracer or Java debugger records bounded runtime events, source lines, local values, reachable collections, result, or an explicit error. The service removes the temporary container and returns a structured response.
5. **Understand and navigate.** The UI stores the immutable event list for the current page session. Playback selects an event; the visualized values, code line, and explanation are derived from the same position. Changing source or inputs clears the old trace.
6. **Try another case.** The learner changes the method or arguments and runs again. There are no accounts, saved runs, or cloud calls.

The pattern-simulation route skips the local service: the typed TypeScript engine recognizes a bounded pattern, creates a modeled trace, and shows its explanations with an explicit simulation label. An unrecognized pattern produces a clear non-recognition message.

## Stack

| Part | Technology | Why it fits / documentation |
|---|---|---|
| Browser UI | React 19, TypeScript 6, Vite 7 | Reuses the existing responsive app and typed trace engine. [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/docs/), [Vite](https://vite.dev/guide/) |
| Local startup coordinator | Node.js built-in child-process and networking APIs; `scripts/start-local.mjs` | Starts both local services with one cross-platform command and no additional package. [Node.js child_process](https://nodejs.org/api/child_process.html) |
| Local API and sandbox coordinator | Python 3.10+ standard library | Reuses the current loopback HTTP service and avoids adding Python packages. [Python http.server](https://docs.python.org/3/library/http.server.html), [Python subprocess](https://docs.python.org/3/library/subprocess.html) |
| Actual execution | Docker Desktop with Linux containers; pinned Python 3.13 and Eclipse Temurin Java 21 images | Keeps submitted code off the host process. Containers are defense in depth, not a promise that arbitrary hostile code is harmless. [Docker Desktop on Windows](https://docs.docker.com/desktop/setup/install/windows-install/), [Docker security](https://docs.docker.com/engine/security/) |
| Trace capture | Python `sys.settrace`; Java Debug Interface (JDI) | Captures real supported runtime events rather than inferring a full execution from source. [Python tracing](https://docs.python.org/3/library/sys.html#sys.settrace), [Java 21 JDI](https://docs.oracle.com/en/java/javase/21/docs/api/jdk.jdi/module-summary.html) |
| Verification | Vitest, Python `unittest`, TypeScript production build | Uses the tests and checks already present. [Vitest](https://vitest.dev/guide/) |

The installed development environment has Node.js 22.16 and npm 11; the project lockfile selects the frontend packages. Docker is needed for actual code execution, not for the browser-based pattern simulator. The first build of each language image may download its pinned base image.

## Where It Runs and How Someone Tries It

AlgoLens runs locally on Windows in a browser. The prerequisites are Node.js/npm and Python 3.10 or later available as `python`; Docker Desktop using its Linux-container engine is required only for actual Python/Java runs. Docker must stay running during execution. Pattern simulation remains available when Docker is unavailable.

From the project root, run `npm install` on a fresh checkout, then run `npm run start:local`. The launcher starts the loopback runner and Vite together, reports startup problems, and stops both processes when the terminal is closed with Ctrl+C. It checks supported local ports (Vite 5173/5174 and runner 8765–8774), so it can coexist with another local development session. Docker offline does not block UI startup: the pattern simulator remains usable, and code execution shows an unavailable message without falling back to running pasted code on Windows.

Open the local URL Vite prints, normally `http://localhost:5173/`. Choose **Code execution** for a real supported Python/Java trace or **Pattern simulation** for a clearly labeled modeled example. For a reliable recording, use a short Java array/binary-search example, enter its JSON arguments, run it, and step through the result and explanation.

For troubleshooting, the services can still be started separately: run `npm run runner` in one PowerShell terminal and `npm run dev` in another. Do not run pasted source directly on the host as a workaround for Docker being unavailable.

No hosted deployment is part of the proof of concept. A short demo video and a public GitHub repository are required later for submission; deployment does not replace either. See the actual submission form for its current video constraints.

## Look and Feel

Keep the existing focused workbench rather than switching to a generic chat layout. Preserve the dark/light theme toggle, clear separation between Pattern simulation and Code execution, visible execution and simulation labels, and readable code/state/explanation panels. On laptop, keep the editor and trace views side by side where practical; on narrow screens, stack them in a useful reading order and keep playback controls reachable. Use concise, plain-English messages and never use color as the only signal for a changed value or error.

PRD refs: `prd.md > Screens and Layout`, `prd.md > Look and Feel`.

## Components

### Workbench shell and Pattern simulator — `src/main.tsx`

Owns the app shell, mode selection, theme, pattern inputs, visual state, playback, and simulation explanation log. It calls the deterministic engine and invalidates a trace when its source or inputs change. Pattern output remains a modeled trace, never a claim about execution of the pasted source.

PRD refs: `prd.md > The Core Journey`, `prd.md > Screens and Layout`, `prd.md > Showing a pattern simulation`.

### Deterministic pattern engine — `src/engine.ts`

Recognizes only the patterns the app supports, validates their inputs, and returns typed steps and explanations. It has no network, runtime execution, or AI dependency. Unknown patterns return an explicit unsupported/non-recognition result rather than a plausible-looking trace.

PRD refs: `prd.md > Showing a pattern simulation`, `prd.md > Explaining errors and limits`.

### Actual execution panel — `src/ExecutionPanel.tsx`

Collects the source, language, selected method, JSON arguments, and optional expected result; calls the local API; and renders source position, active frame, locals, reachable collections, return value, messages, and playback controls. It clears an old trace before a new run or after edits. The optional expected-result check compares one returned value only; it does not prove general algorithm correctness.

PRD refs: `prd.md > Running a supported method`, `prd.md > Explaining errors and limits`, `prd.md > States and Boundaries`.

### Runtime explanation helper — `src/execution-explanations.ts`

Formats a plain-English step from the current and previous runtime events, source line, and captured values. It reports only captured local-value changes by default. Its additional condition recognizers are deliberately narrow: an empty Python named iterable when the next captured line leaves its block, and a Java `for` loop with a literal initial value, simple comparison, literal or named array-length bound, and a supported increment. It computes the condition directly from literals and captured collection lengths; it never evaluates submitted source or calls a submitted method. Any other condition or ambiguous event gets a neutral state description rather than an inferred diagnosis.

PRD refs: `prd.md > Running a supported method`, `prd.md > Explaining errors and limits`.

### Local trace API — `runner/server.py`

Binds only to loopback. `GET /api/health` reports whether the Docker sandbox is available. `POST /api/trace` accepts a bounded JSON request containing `language`, `source`, `method`, and `arguments`; it validates the request, allows one active run, starts the matching language container, and returns structured status, events, result, diagnostics, and truncation information. It does not store source, inputs, or traces.

PRD refs: `prd.md > Running a supported method`, `prd.md > Explaining errors and limits`, `prd.md > States and Boundaries`.

### Language runners and sandbox images — `runner/container/` and `runner/java/`

The Python runner uses a tracing hook. The Java runner compiles and invokes the selected method with the JDK's debugger interface. Each request uses a fresh, restricted container with bounded CPU, memory, process count, input, output, runtime, and trace size; no network and no host directory are provided. Containers are removed after completion or failure. A truncated trace is explicitly marked incomplete.

PRD refs: `prd.md > Running a supported method`, `prd.md > Explaining errors and limits`.

### Local startup coordinator — `scripts/start-local.mjs`

Starts the Python runner and Vite from one command, chooses from documented loopback ports, waits for the runner to listen and the app to respond, prints app and health URLs, reports missing prerequisites clearly, and shuts down the child processes together. Docker health is checked after the app starts so a stopped Docker engine cannot block Pattern simulation. The runner port is passed to Vite so its same-origin proxy targets the selected loopback service.

PRD refs: `prd.md > The Core Journey`, `prd.md > States and Boundaries`.

### Same-origin development proxy — `vite.config.ts`

Serves the UI and forwards `/api` requests to the loopback runner port selected by the startup coordinator (default 8765). It keeps the browser request same-origin and adds the existing security headers. It is a local development/preview arrangement, not a public production hosting service.

PRD refs: `prd.md > Running a supported method`, `prd.md > States and Boundaries`.

## Data Model

| Data | Where it lives and changes | When the learner leaves |
|---|---|---|
| Source, language, method, arguments, expected result | React component memory in the current browser page; edited directly in the workbench | Not saved; refreshing or closing the tab loses the current values |
| Pattern trace and explanation | Typed immutable step list returned by `src/engine.ts`, held in React memory; playback changes only the selected step index | Not saved; changing source/input clears it |
| Runtime trace and explanation | Structured response returned from the loopback API and held in the browser page; playback selects a position in the event list | Not saved; edits/reruns invalidate it, and refresh/close discards it |
| One execution request | Sent from the browser to `127.0.0.1` as JSON through Vite, validated by the runner on its selected loopback port, passed to a temporary container, then discarded | Not persisted or logged by AlgoLens |
| Theme | Browser `localStorage` key `algolens-theme` | Survives refresh on that browser; it is the only user preference stored |

There is no application database, account, or remote AI/API service.

## File Structure

This is the current project layout plus the checklist and visual spec companion. Generated dependency and build folders are omitted.

```text
Code_Visualizer/
├── .agents/skills/                 # Installed Devpost Learn workflows and templates
├── devpost/
│   ├── learner-profile.md           # Private learning context; excluded from public Git by default
│   ├── scope.md                     # Approved product boundary
│   ├── prd.md                       # Approved user-facing requirements
│   ├── spec.md                      # This Skill Pack technical blueprint
│   ├── spec.html                    # Offline visual companion to this blueprint
│   └── checklist.md                 # Ordered build slices; created in 5-build
├── public/                          # App icons and static assets
├── scripts/
│   └── start-local.mjs              # Starts local runner and Vite together
├── src/
│   ├── assets/                      # Existing images and starter assets
│   ├── main.tsx                     # Workbench and Pattern simulator UI
│   ├── ExecutionPanel.tsx           # Actual code execution UI
│   ├── engine.ts                    # Deterministic pattern recognition and traces
│   ├── engine.test.ts               # Pattern engine tests
│   ├── execution-explanations.ts    # Evidence-based runtime wording
│   ├── execution-explanations.test.ts # Condition/explanation tests
│   └── styles.css                   # Workbench styling
├── runner/
│   ├── server.py                    # Loopback API and container lifecycle
│   ├── test_java_integration.py     # Java runner integration tests
│   ├── container/
│   │   ├── Dockerfile               # Pinned Python sandbox image
│   │   ├── trace.py                 # Python runtime tracing
│   │   └── test_trace.py            # Python trace tests
│   └── java/
│       ├── Containerfile            # Pinned Java sandbox image
│       ├── Harness.java              # Selected-method input/result bridge
│       ├── Runner.java               # Java debugger controller
│       └── Json.java                 # Bounded JSON support
├── index.html
├── package.json / package-lock.json # Frontend dependencies and scripts
├── vite.config.ts                   # Local proxy and headers
├── README.md                        # Setup, supported subset, limits, verification
└── SYSTEM_DESIGN.md                 # Detailed local execution design
```

The root `spec.md` is an existing technical note about the original pattern-simulation path; it is not this Skill Pack deliverable and will not be overwritten. The official planning sequence lives under `devpost/`.

## External Services and Dependencies

- **No hosted APIs, model calls, database, or API keys.**
- **Docker Desktop** is a local dependency for actual code execution. The runner invokes the local Docker CLI to inspect/build pinned images and create/start/remove a container. Build-time image downloads require internet access once; submitted source and inputs are not sent to a hosted service. [Docker Desktop documentation](https://docs.docker.com/desktop/).
- **Vite's local proxy** forwards `/api` to the runner port selected by the launcher (8765 by default); no third-party network endpoint is called by the app.
- **npm packages** are installed from the existing lockfile. `npm install` needs registry access when packages are not already cached; the browser app itself does not call the npm registry.

## Important Failure Modes

- **Docker is stopped or missing** → the app and Pattern simulation still start; the execution panel says the sandbox is unavailable. Never execute pasted code directly on the host.
- **Unsupported method, invalid JSON, or runtime/compile error** → show a useful message for that attempt, clear stale trace data, and allow edits/retry.
- **Execution exceeds a limit or trace is clipped** → stop/clean up the run and mark the trace incomplete; do not present it as a complete execution.
- **A condition or state change is outside the explanation helper's safe subset** → show the observed event/state and explicitly say the cause could not be determined; do not infer a bug.
- **A local service fails to start or its supported ports are occupied** → the one-command launcher reports the failing service/port and stops any child it already started.

## What Was Simplified and Why

- **A local, bounded Python/Java runner** instead of a hosted execution service — avoids accounts, API keys, hosting cost, and sending source code to a third party. It requires Docker Desktop and is intended for local demos, not public multi-user hosting.
- **Template-based explanations grounded in trace evidence** instead of an LLM call — keeps claims tied to observed state, works offline, and avoids model cost or unsupported confidence.
- **One browser session with no saved runs** instead of accounts/database — proves the core learning loop without persistence infrastructure.
- **A small condition grammar** instead of general-purpose diagnosis — enables a few directly evidenced explanations while making the unsupported boundary explicit.
- **Pattern simulation remains a separate mode** instead of pretending every pasted algorithm can be executed or recognized.
- **One local startup command** instead of requiring two terminals — removes routine demo friction without hiding Docker's role or adding another service.

## Decisions and Open Issues

### Decisions

- **Learner-approved:** keep the existing React/Vite app, local Python runner, and Docker-isolated Python/Java execution rather than redesigning the stack. Tradeoff: execution needs Docker and first-time image downloads.
- **Learner-approved:** improve local setup with one command that starts the UI and runner together. Docker-unavailable must leave Pattern simulation usable and must never trigger host execution.
- **Learner-approved:** add a plain-English runtime explanation layer grounded in actual trace evidence. The learner delegated the safest condition-checking detail; implementation limits it to an explicitly tested grammar with an unsupported fallback.
- **Carried forward from `scope.md` and `prd.md`:** keep Pattern simulation distinct from execution; do not claim universal LeetCode support, automatic diagnosis of every bug, or ungrounded AI explanations.
- **Useful uncertainty clarified:** Docker's purpose is to isolate submitted code, not to make the pattern simulator work. Removing the container would make actual execution less safe; Docker is therefore retained, while startup is simplified.
- **Implemented:** use Node's built-in process and networking APIs to launch the UI and runner; no new dependency was added.
- **Verified in the current Windows environment:** the existing services occupied default ports 5173/8765; the launcher selected 5174/8766, served the app, proxied a Java trace to the container, and closed both service ports when sent SIGINT. Docker-offline behavior is implemented using the existing 503 health response but was not simulated by stopping Docker.

### Open issues for the build

- Define and test the exact safe grammar for the runtime condition helper before it makes any causal statement. It should start with simple local comparisons and array-length checks; unsupported expressions must not be evaluated.
- Add tests showing both the correct explanation for supported conditions and the explicit fallback for unsupported or ambiguous ones.
- The Python/Java runtime's supported syntax and data types remain bounded as documented in `README.md`; expand only with explicit tests and documentation.
