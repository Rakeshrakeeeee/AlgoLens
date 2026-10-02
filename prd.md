# Code Visualizer — Product Requirements

## 1. Summary

Code Visualizer is an interactive learning tool that turns supported DSA snippets into a reversible, visual execution trace. The learner can inspect each state transition and its plain-English explanation while seeing the relevant code and array indices.

The long-term vision covers common LeetCode/DSA learning workflows. The pattern-simulator V1 covers array, two-pointer, and sorting simulations in C++, Java, Python, and JavaScript. Separate Python and Java execution betas trace bounded documented subsets inside a local sandbox; they do not claim coverage of all LeetCode solutions.

## 2. Users and needs

### Primary user

A student or self-directed learner who understands basic programming syntax but finds it difficult to reason about intermediate algorithm states.

### User needs

- “I want to see what changed at each step, not just read the final result.”
- “I want to know why a comparison, pointer move, or swap happened.”
- “I want to try another input and step through it myself.”
- “I need to know when my code is outside what this tool supports.”

## 3. Goals and non-goals

### Goals

1. Make supported algorithms inspectable one event at a time.
2. Keep code, visualization, playback position, and explanation synchronized.
3. Support an explicit and testable subset of four common languages.
4. Make the core learning flow work locally without an account or API key.
5. Establish an extensible algorithm/trace contract for later DSA domains.

### Non-goals for V1

- Executing arbitrary pasted programs or acting as a debugger/compiler.
- Claiming coverage of all DSA or competitive-programming techniques.
- Requiring a cloud service, LLM, sign-in, or saved account data.
- Grading submissions or proving algorithm correctness for arbitrary input.

## 4. V1 scope

### Algorithm catalog

- **Array operations:** read, write, swap, insert, and delete.
- **Two pointers:** reverse an array, find a pair-sum in a sorted array, palindrome-style inward comparison, and remove duplicates from a sorted array.
- **Searching:** binary search over a sorted array, showing midpoint comparisons and the shrinking search interval.
- **Sorting:** bubble, selection, insertion, merge, and quick sort.

Each item is recognized from common code patterns in C++, Java, Python, and JavaScript, including typical LeetCode class/method wrappers. Recognition is heuristic and bounded to supported array patterns; it never evaluates user-provided source. Unsupported or ambiguous code is rejected instead of being guessed.

### Core experience

1. Choose a catalog example and language, or paste a supported snippet.
2. Edit the input values and algorithm parameters in a clearly labeled input area.
3. Validate the snippet and input.
4. Start a trace to see the initial state and event list.
5. Move through the trace using playback controls or the event log.
6. Review the final state or reset and try a different input.

### Functional requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-1 | Provide a code editor/input area with language selection for C++, Java, Python, and JavaScript. | Must |
| FR-2 | Provide catalog examples that load a matching language snippet and editable input. | Must |
| FR-3 | Recognize supported array/search patterns across the four languages and validate input bounds/types before tracing. | Must |
| FR-4 | Reject unsupported or invalid input with a specific, actionable message; do not generate a misleading trace. | Must |
| FR-5 | Produce a deterministic sequence of typed events and state snapshots for each accepted input. | Must |
| FR-6 | Visualize array values and relevant indices/pointers, highlighting the current event's operands and changes. | Must |
| FR-7 | Provide Play, Pause, Next, Previous, Reset, and adjustable playback speed. | Must |
| FR-8 | Show a chronological explanation log derived from the trace events and synchronize its active entry with playback. | Must |
| FR-9 | Let a learner select an explanation-log entry to navigate to that trace position. | Should |
| FR-10 | Display completion and final result clearly, including the final array where relevant. | Must |
| FR-11 | Keep code, input, and traces on the learner's device; no remote API or persistence. The separate execution beta may pass bounded data through the loopback runner and disposable container only. | Must |
| FR-12 | Preserve a usable layout on desktop and narrow screens, and support keyboard-accessible controls. | Should |
| FR-13 | Offer a light/dark theme toggle and remember the learner's selection in the browser. | Should |
| FR-14 | Limit source length before analysis and reject patterns that cannot be confidently recognized. | Must |
| FR-15 | Show the modelled local variables and array heap snapshot at the selected trace step, marking values changed from the previous step. | Should |
| FR-16 | Map modelled events to source lines when identifiable and highlight detectable syntax errors with an actionable diagnostic. | Should |
| FR-17 | In Python/Java execution mode, render array/string values from the selected runtime snapshot and visibly identify value changes between steps. | Must |
| FR-18 | Let a learner provide an optional expected JSON result for an execution input and compare it with the actual return value without presenting this as a proof of general correctness. | Should |
| FR-19 | Detect ordinary Python/Java method declarations in execution mode, allow the learner to select the method, and invoke it through the local harness without requiring a user-written `main`. | Must |
| FR-20 | Trace binary search on sorted integer arrays, showing midpoint comparisons, bound updates, and the final found/not-found result. | Must |

### Explanation requirements

- Binary-search explanations identify the checked midpoint, explain why the sorted range can be halved, and reject unsorted input rather than showing a misleading trace.
- Explanations are plain English and generated deterministically from event type and event metadata.
- Every explanation identifies the relevant values/indices and the action or decision.
- No explanation may claim an event absent from the trace.
- The active explanation and visual state always correspond to the same trace position.
- Use concise language suitable for learners; define algorithm-specific terms when first used.

## 5. User experience and interface

The main workspace contains:

- A header with product name and algorithm/language selection.
- A code/input area with validation status and an explicit supported-subset note.
- A visualization pane with the array and labels for active indices/pointers.
- A compact variables-and-memory inspector synchronized with the selected playback state.
- Playback controls and a progress indicator.
- An explanation/event log.

On narrow screens, panes may stack vertically while controls and current-step status remain easy to reach. Empty, invalid, playing, paused, and completed states must all be designed.

## 6. Quality requirements

- **Correctness:** trace generation is deterministic and state transitions are internally consistent.
- **Safety:** the pattern simulator never executes pasted source. Python and Java execution are available only through separate, resource-limited Docker betas.
- **Clarity:** controls have accessible names; active pointers/events do not rely on color alone.
- **Performance:** supported examples with bounded input sizes start tracing without noticeable delay in a current desktop browser.
- **Privacy:** no source/input is transmitted to a remote service or persisted; execution data is sent only to the local loopback runner and Docker engine. Do not add telemetry.
- **Resilience:** malformed or out-of-range input returns a visible error and leaves the UI usable.
- **Honest tracing:** simulated algorithm-pattern traces are labeled as modelled traces, not exact execution of arbitrary pasted code.

## 7. Success measures

V1 is ready when:

- Every catalog algorithm has working fixtures in all four languages.
- Every fixture validates, generates the expected final state, and supports complete forward/backward playback.
- Unsupported syntax and invalid values fail with explicit validation messages.
- A first-time learner can complete the core flow without setup instructions or credentials.
- Manual usability checks pass at desktop and narrow viewport widths.

No usage tracking is required for V1. Product usefulness should initially be evaluated through observed learner tests and feedback.

## 8. Roadmap

1. **V1:** pattern-level array operations, two-pointer patterns, and comparison sorts.
2. **Execution foundation (in progress):** local-only disposable sandbox, shared trace contract, LeetCode-style input harness, and Python/Java execution traces. The current beta implements Python and Java runners and a shared trace UI; it is not a promise to support all LeetCode code.
3. **Language expansion:** JavaScript and C++, each gated on its own reliable instrumentation and sandbox tests.
4. **Algorithm-domain expansion:** searching, hashing, stacks/queues, linked lists, recursion, trees, heaps, tries, graphs, dynamic programming, greedy, and backtracking.
5. **Optional product capabilities:** optional trace-grounded AI explanations, saved/shareable sessions, and instructor workflows.

Prioritize later phases through learner research; do not represent roadmap topics as supported until their validators, traces, visuals, and tests ship.

See [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md) for the local execution architecture, sandbox policy, trace contract, rollout, and verification gates; [README.md](./README.md) explains how to run the current beta.
