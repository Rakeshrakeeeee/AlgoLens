# Code Visualizer — Technical Specification

## 1. Purpose

Define the V1 implementation contract for a client-only DSA visualizer. This document is the technical companion to [scope.md](./scope.md) and [prd.md](./prd.md).

## 2. Proposed architecture

- **Application:** React + TypeScript, built with Vite.
- **Runtime:** pattern simulation is browser-only; no application server or remote API is required. Separate Python and Java execution betas use a loopback-only local runner; they require no remote service.
- **Core pipeline:** source text and user input → language-specific safe recognizer/validator → typed algorithm configuration → deterministic trace → visualization, playback, and explanation log.
- **State model:** trace data is immutable after generation; playback selects a position in the trace instead of incrementally mutating the algorithm's source state.
- **Dependency policy:** prefer a small dependency set; add parsers or UI libraries only when the accepted snippet grammar and implementation need justify them.

The source shown to the user is never passed to `eval`, `Function`, a shell, a compiler, or another execution environment.

This describes the pattern-simulation path only. Do not weaken this guarantee by adding direct host execution. Separate Python and Java execution betas use the isolated local runner described in [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md) and remain explicitly labeled modes.

## 3. Module boundaries

Suggested source organization:

```text
src/
  app/                 Application shell and workspace layout
  components/          Code input, visualization, controls, and event log
  algorithms/          Shared algorithm semantics and catalog metadata
  languages/           C++, Java, Python, and JavaScript recognizers
  trace/               Event types, snapshot construction, and invariants
  playback/            Position, play/pause, timing, and speed
  explanations/        Deterministic event-to-text mappings
  validation/          Input and supported-subset validation
```

Exact file names can follow the generated project conventions. Keep language recognition separate from algorithm execution semantics so equivalent snippets in different languages produce the same trace.

## 4. Domain contracts

Use discriminated TypeScript unions for algorithms and events. Avoid untyped event payloads.

Conceptual types:

```ts
type Language = "cpp" | "java" | "python" | "javascript";

type AlgorithmId =
  | "array-read"
  | "array-write"
  | "array-swap"
  | "array-insert"
  | "array-delete"
  | "two-pointer-reverse"
  | "two-pointer-pair-sum"
  | "two-pointer-palindrome"
  | "two-pointer-remove-duplicates"
  | "bubble-sort"
  | "selection-sort"
  | "insertion-sort"
  | "merge-sort"
  | "quick-sort";

type TraceEvent =
  | { type: "compare"; indices: number[]; values: number[]; reason: string }
  | { type: "pointer-move"; pointer: string; from: number; to: number; reason: string }
  | { type: "swap"; left: number; right: number; valuesBefore: number[] }
  | { type: "write"; index: number; before: number; after: number }
  | { type: "insert"; index: number; value: number }
  | { type: "delete"; index: number; value: number }
  | { type: "mark"; indices: number[]; label: string };
```

The final implementation may refine the event variants, but each event must have enough typed metadata to:

1. Reconstruct the state before and after the event.
2. Render all relevant visual highlights.
3. Generate an accurate deterministic explanation.
4. Identify the originating source location when available.

A trace contains the initial snapshot and an ordered event sequence. Each playback position resolves to one stable snapshot, including modelled local variables and heap-backed array values. Forward and backward navigation must not rerun the algorithm.

## 5. Input recognition and validation

### Recognizer contract

Each language adapter accepts source text and returns either:

- A typed, normalized algorithm configuration with source spans for recognized operations; or
- A structured validation error with a useful message and, where possible, a source location.

Recognition is heuristic and bounded to the documented V1 array patterns, including common LeetCode class/method wrappers. Comments and whitespace can be ignored where safe. Enforce a maximum source length before scanning; reject unsupported or ambiguous constructs rather than silently ignoring them.

All four language adapters map supported syntax to shared algorithm semantics. Equivalent inputs must produce equivalent events and final states across languages.

### Input validation

- Require integer array values for V1 algorithms unless an algorithm explicitly declares otherwise.
- Validate algorithm-specific preconditions (for example, sorted input for sorted pair-sum and duplicate removal).
- Set a documented maximum array length and value range before implementation; surface violations inline.
- Validate source and user data before trace generation.
- Reject source above the configured size limit before applying recognition patterns to keep local analysis work bounded.
- Handle empty and single-element arrays according to each algorithm's defined behavior.

## 6. Trace generation

- Implement each catalog algorithm as a deterministic function over a validated configuration.
- Record events and snapshots without mutating the input owned by the UI.
- Ensure each event is a valid transition from its preceding snapshot.
- Assert or test that the final snapshot satisfies the algorithm's expected postcondition.
- Avoid producing a partial trace after validation or execution failure.
- Use bounded input sizes to keep full snapshots and playback responsive.

## 7. Playback and synchronization

- Playback state is the current event/snapshot index, playing flag, and selected speed.
- Play advances on a timer; Pause stops advancement without changing the current state.
- Next/Previous move exactly one event and clamp at trace boundaries.
- Reset returns to the initial snapshot and stops playback.
- Reaching the final event stops playback and shows completion.
- Changing source, algorithm, or input invalidates the old trace and returns playback to its initial state.
- Selecting a log item seeks to the corresponding event.
- The visualization, code highlight, progress indicator, and selected explanation derive from the same playback index.
- Map modelled trace events to matching source lines where the recognizer can identify them. Clearly label pattern simulations; do not imply execution of arbitrary pasted source.
- Timer cleanup is required on pause, reset, trace replacement, and component unmount.

## 8. Interface behavior

- Keep source editing, input editing, validation result, visualization, controls, and explanation log as separately testable components.
- Show a clear validation state before a trace exists.
- Disable playback controls when there is no valid trace.
- Make unsupported syntax errors explicit and avoid displaying stale trace state after source/input changes.
- Provide keyboard focus indicators and accessible names for all playback controls.
- Provide a light/dark theme toggle and persist the selected theme in browser storage.
- Do not use color as the only way to distinguish pointers or event types.
- Provide a responsive stacked layout for narrow viewports.

## 9. Error handling

Expected user input failures (unsupported syntax, invalid preconditions, out-of-range values) are represented as validation results and shown next to the relevant input.

Unexpected failures in trace generation must be reported visibly as an error, clear or invalidate the trace, and leave the user able to edit and retry. Do not replace failures with an empty or success-shaped trace.

## 10. Testing requirements

### Unit tests

- Recognizer fixtures for each supported algorithm/language pair.
- Rejection fixtures for unsupported syntax and malformed input.
- Delimiter-error line detection, modeled memory snapshots, and source-line mapping for supported pattern traces.
- Algorithm edge cases, including empty/single-element input where valid, duplicates, already sorted/reverse sorted arrays, and pair-sum not found.
- Event transition and final-state invariants.
- Explanation mappings for every event variant.
- Playback boundary, timer, reset, and trace-replacement behavior.

### Integration tests

- Select example → validate → play → pause → next/previous → reset.
- Change input and confirm the previous trace cannot be played.
- Select an explanation entry and confirm visualization seeks to the matching state.
- Confirm invalid and unsupported snippets show errors with no trace.

### Cross-language consistency

For each catalog algorithm, equivalent fixtures in C++, Java, Python, and JavaScript must normalize to equivalent configurations and produce the same semantic event sequence and final result.

## 11. Delivery constraints

- Pattern-simulator V1 requires no secrets, backend deployment, or external API.
- Source and input are not sent to a remote service or persisted. Python and Java execution pass bounded data through the loopback runner and local Docker engine; returned traces remain in browser memory for the current session.
- Serve with a restrictive Content Security Policy and standard browser security headers; production hosting must apply the documented response headers.
- Keep the algorithm catalog and supported grammar visible/documented; future additions must include fixtures and acceptance tests before being advertised as supported.

## 12. Local Python and Java execution betas

The Python and Java betas are separate local execution paths—not a change that treats the current pattern recognizer as a runtime. They use a loopback-only API, disposable restricted containers, source-detected method selection and a JSON argument harness, and language-specific runtime line/call/return/exception instrumentation. The sandbox harness invokes the selected LeetCode-style method, so learners do not need to provide `main`. Code must never execute directly on the host, and runner failure must not silently fall back to a simulated or partial trace.

Python execution uses Python 3.13. Java execution uses Java 21 JDI line stepping and compiles submitted `Solution.java` source inside the isolated image. Neither adapter implements arbitrary LeetCode serialization or every language runtime feature. Additional languages require separate instrumentation and security/trace verification. Docker Desktop's Linux engine is the Windows sandbox dependency. If it is unavailable, the existing simulator remains usable and execution mode reports a clear setup error.

See [README.md](./README.md) for startup instructions and known limitations; [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md) defines the detailed architecture and acceptance gates.
