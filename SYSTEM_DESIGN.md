# AlgoLens — Local Execution System Design

## Objective

Evolve AlgoLens from a pattern simulator into a local-first execution visualizer. For supported languages and LeetCode-style entry points, the learner supplies code and input, the app runs that code in an isolated local sandbox, and a language adapter turns runtime events into a reversible trace.

“Every LeetCode solution” cannot be guaranteed by a finite visualizer. The supported language versions, input types, entry-point conventions, and runtime behavior must be explicit. Unsupported features must fail clearly rather than produce an invented or partial trace.

## User experience

1. Select a language and paste a LeetCode-style `Solution` implementation.
2. Select or confirm the method to call and enter its arguments as JSON.
3. Validate the source and input, then run in a disposable sandbox.
4. Review the result, output, source-linked runtime events, variables, call stack, and reachable heap objects.
5. Step, play, pause, seek, and inspect the same immutable trace.
6. See a clear diagnostic for syntax errors, runtime exceptions, timeouts, resource limits, unsupported values, or trace truncation.

The existing pattern simulator remains usable as an offline fallback; it must be labeled as a simulation and must never be presented as execution of the submitted source.

## Architecture

```text
React/TypeScript UI
  ├─ editor, language and input form
  ├─ trace playback and visualizations
  └─ same-origin local API request
       ↓
Loopback trace service (127.0.0.1)
  ├─ request/schema and size validation
  ├─ language adapter and LeetCode harness
  ├─ per-run lifecycle, limits, and diagnostics
  └─ sandbox runner
       ↓
Disposable, restricted container
  ├─ pinned language runtime
  ├─ instrumentation bootstrap
  ├─ submitted solution and generated input harness
  └─ bounded structured trace output
```

The browser is responsible for editing, playback, rendering, and seeking. A local trace service coordinates execution and is the only component allowed to invoke the container runtime. The visualizer consumes a language-neutral trace contract; language-specific adapters normalize source locations, stack frames, variables, and heap values.

### Loopback API

- Bind only to `127.0.0.1`; never listen on a LAN interface by default.
- Serve the production UI and API from one origin. In development, use a same-origin Vite proxy.
- Validate the expected `Origin`/`Host`, reject cross-origin browser requests, apply request-size bounds, and do not enable permissive CORS.
- Use a per-process capability token for the local API if the final launch flow can deliver it without exposing it to unrelated origins.
- Do not log submitted source, arguments, variable values, or trace payloads. Return structured diagnostics without echoing sensitive data unnecessarily.
- Do not persist source, inputs, or traces. Remove per-run temporary artifacts when the container exits.

### Sandbox policy

Use a pinned, locally available container image and a fresh container for each run. The orchestrator must:

- Disable networking (`--network none`); do not pass credentials or environment secrets.
- Mount no host directories; pass source and input through bounded stdin or an ephemeral in-container channel.
- Run as a non-root user with a read-only root filesystem, dropped Linux capabilities, and `no-new-privileges`.
- Apply CPU, memory, process-count, temporary-storage, wall-clock, source-size, input-size, stdout/stderr, and trace-event limits.
- Stop and remove the container on completion, timeout, cancellation, or service shutdown.
- Keep compiler/runtime and tracing bootstrap files immutable in the image.
- Treat container isolation as a defense-in-depth boundary, not a guarantee against every container-runtime or kernel vulnerability. Keep Docker Desktop and its VM updated.

Current execution limits: 1 CPU, 256 MiB memory, 64 processes, 10 seconds for Python and 8 seconds for Java, 12,000 characters of source, a 32 KiB combined request, 64 KiB captured output, 1,000 events, and 4 MiB of serialized events. A capped trace must say it was truncated; it must not appear complete.

Docker Desktop on Windows typically runs Linux containers in a WSL2-backed Linux VM. The user needs Docker Desktop installed, its Linux engine running, and the AlgoLens runner image available. Image download is a one-time disk/network cost; actual submitted source and inputs remain on the laptop. Containers consume bounded CPU and memory while a run is active. The system must not silently fall back to executing code directly on the Windows host if Docker is unavailable.

## Trace contract

Use a versioned, JSON-safe, language-neutral trace format. A trace includes metadata (language/runtime, source hash, trace schema version, truncation status), final result, and ordered events. Each event should include:

- Sequence number and event kind (`call`, `line`, `return`, `exception`, or a language-neutral mutation event).
- Source file and 1-based line/column where known.
- Stable frame ID and parent frame ID for recursion/call-stack inspection.
- A bounded snapshot or delta of frame locals.
- A bounded graph of reachable heap objects, with stable object IDs and references so cycles and aliasing are represented without recursive JSON expansion.
- Optional output/error metadata, with output limits.

Primitive values, strings, sequences, dictionaries/maps, user objects, linked lists, and trees require explicit serialization rules. Unknown/native values use a safe type-and-summary representation; serializers must not call user-defined display methods or execute submitted code. Snapshot depth, object count, string length, and bytes per event are bounded.

The frontend derives the selected state by replaying an immutable initial snapshot and event/delta sequence. It must not rerun source when navigating backward. A source line, call-stack view, variable panel, object graph, and explanation must all derive from the same trace position.

## Language adapters and LeetCode inputs

Each adapter owns source parsing/instrumentation, runtime diagnostics, and its LeetCode harness, but emits the same trace contract. The learner must be able to specify an entry point and typed/JSON arguments; AlgoLens must not guess ambiguously which method to call.

LeetCode's serialized inputs need defined conversions for each supported type, including nested arrays and, as those domains are added, linked lists, binary trees, and graphs. The app should show the decoded values before execution. The harness calls only the selected solution entry point and serializes its result; it does not contact LeetCode.

### Language rollout

1. **Python beta (implemented):** common LeetCode class/method solutions and JSON-compatible primitives, strings, lists, nested lists, and dictionaries. The current runner captures Python frames, line events, locals, exceptions, and bounded reachable object graphs.
2. **Java beta (implemented):** a bounded `Solution` class/method harness with declared-type JSON conversion, Java 21 compilation, JDI line stepping, locals, array/string visualization, expected-result comparison, arrays/user-object snapshots, and diagnostics. See [README.md](./README.md) for supported Java inputs and behavior.
3. **JavaScript/TypeScript-compatible subset (planned):** add its own parser/instrumentation and LeetCode harness after the shared trace contract is stable.
4. **C++ (planned):** add a compiled-language adapter, debug symbols, and a debugger/protocol-based capture path. Validate a supported compiler/runtime and toolchain per platform.

Each release must publish its supported syntax, standard-library subset, entry-point rules, and input types. Reflection, native extensions, threads, subprocesses, filesystem/network operations, and other difficult or nondeterministic behavior may be rejected or explicitly unsupported.

## Failure handling

Use explicit result categories: invalid request, unsupported construct, compile/syntax error, runtime exception, timeout, memory/CPU/process limit, runner unavailable, trace limit reached, and successful completion. Include source spans when reported by the parser/runtime. Do not replace failed execution with a pattern simulation or a success-shaped partial trace.

If Docker is missing or stopped, preserve the existing simulator and show actionable setup status for execution mode. Never offer an unsafe host-execution fallback.

## Verification gates

Before enabling a language in the UI, require:

- Golden execution traces for loops, branches, nested calls, recursion, variable reassignment, arrays/objects, aliasing, and exceptions.
- Consistent event and final-result behavior across repeated runs.
- Correct LeetCode harness behavior for each supported signature and serialized type.
- Tests for syntax errors, runtime exceptions, infinite loops, large output, deep recursion, large objects, cancellation, and trace truncation.
- Adversarial sandbox tests for denied networking, host-file access, subprocess/resource abuse, and cleanup after failure.
- Confirmation that no code/input is persisted or sent to a remote service.
- Trace UI checks for forward/backward playback, source-line synchronization, and bounded rendering.

“Supported” means these gates pass for the documented subset. Passing a sample set does not establish support for every valid LeetCode answer.
