# Code Visualizer — Scope

## Product vision

Code Visualizer helps people learning data structures and algorithms understand how code executes. A learner provides a supported algorithm snippet and input, then follows an inspectable sequence of state changes, visual cues, and plain-English explanations.

The long-term product aims to cover common LeetCode/DSA learning workflows through explicitly supported languages, inputs, and runtime features. It is not an unrestricted general-purpose debugger, judge, or arbitrary-code execution service.

## Audience and problem

**Primary audience:** students and self-directed learners studying DSA or preparing for coding interviews and competitive programming.

**Problem:** algorithm explanations often describe the final answer or abstract idea, but learners need to see how values, pointers, and intermediate state change at each operation.

## Product principles

- Make every displayed state and explanation traceable to a concrete algorithm event.
- Favor correctness and clear validation over claiming to understand arbitrary code.
- Keep user code local. The current V1 pattern simulator never executes pasted source code; any later execution mode must run only inside an isolated local sandbox.
- Make the first usable experience self-contained, with no account, backend, or API key.
- Build the trace model so future DSA domains can reuse playback, visualization, and explanation infrastructure.

## Phased scope

### V1 — Array and sorting visualizer

V1 is a product-quality, bounded first release, not a one-off recorded-demo flow.

- Recognize common array-algorithm patterns in C++, Java, Python, and JavaScript, including typical LeetCode class/method wrappers; reject ambiguous or unsupported code.
- Provide a curated catalog covering:
  - Array reads, writes, swaps, insertion, and deletion.
  - Two-pointer traversal patterns, including reverse, sorted pair-sum, palindrome checks, and remove-duplicates on sorted input.
  - Binary search over sorted arrays, showing midpoint comparisons and shrinking search bounds.
  - Common comparison sorts: bubble, selection, insertion, merge, and quick sort.
- Allow learners to select or edit a supported snippet, select or edit input values, and run validation before tracing.
- Show a visual representation appropriate to the algorithm, including array values, active indices/pointers, comparisons, swaps, and writes.
- Show modelled local variables and the array's heap snapshot beside the visualization, highlighting values that changed in the current step.
- Highlight detectable syntax errors at the offending source line with a clear diagnostic.
- Provide play, pause, next, previous, reset, and playback-speed controls.
- Show a synchronized event/explanation log in plain English.
- Generate explanations deterministically from validated trace events. V1 does not require an AI service.
- Work client-side without accounts, a backend, network access at runtime, or API credentials.

The supported pattern grammar and behavior for each catalog item must be documented. These traces are deterministic models of recognized patterns, not general language-interpreter execution. Formatting and comments may vary where the recognizer can safely map them; unsupported or ambiguous logic must produce an actionable message rather than a partial or misleading trace.

### Later product phases

The product roadmap can add, in measured increments:

- Broader local-only execution visualization using isolated, disposable containers; Python 3.13 and Java 21 beta adapters are implemented for documented subsets, with JavaScript and C++ adapters still to come.
- Searching, hash-based patterns, stacks, queues, and linked lists.
- Trees, heaps, tries, and graph traversal/shortest-path algorithms.
- Recursion, backtracking, greedy algorithms, and dynamic programming.
- More language syntax and broader snippet recognition.
- Optional AI-generated explanations, clearly separated from the deterministic trace of record.
- Saved sessions, sharing, classroom/coach workflows, and progress features if validated with users.

Each added domain must define its supported input grammar, trace events, visuals, explanation rules, and validation tests before being presented as supported.

The execution roadmap does not promise visualization of every valid LeetCode program. Runtime, language, entry-point, serialization, resource, and sandbox boundaries must be documented, and unsupported behavior must be reported rather than approximated. See [README.md](./README.md) for how to run the current Python and Java betas and their limits.

## Out of scope for V1

- General-purpose parsing, compilation, or execution of arbitrary user programs.
- Arbitrary DSA/competitive-programming code beyond the documented catalog and grammar.
- AI or LLM calls, account management, cloud storage, collaboration, leaderboards, or analytics.
- A judge/compiler, submission grading, code generation, or correctness proofs.
- Advanced visualizations for non-array structures.

## Success criteria

- A first-time learner can select a supported example, change its input, and reach a valid trace without setup or credentials.
- Every trace can be moved forward and backward without losing or corrupting state.
- The visualization, highlighted code location, and explanation agree on the current event.
- Unsupported or invalid snippets are rejected before playback with a useful message.
- The same supported input produces the same trace and explanations on repeated runs.
- V1 runs in a current desktop browser and remains usable at tablet/mobile widths.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| “All DSA” is too broad for a reliable first release. | Treat it as the product vision and ship V1 with explicit array/two-pointer/sorting coverage. |
| A constrained snippet recognizer may be mistaken for a full parser. | Document the accepted subset in the UI and reject unsupported syntax explicitly. |
| Traces and prose can drift apart. | Derive both from the same typed event stream and test event/state invariants. |
| Four language adapters multiply implementation and test effort. | Share algorithm semantics and trace events; test each supported language fixture against the same expected trace. |
| A future AI explanation may contradict actual execution. | Keep deterministic trace data authoritative; make any future AI layer optional and grounded in trace events. |

## Interview decisions

- Product aspiration: a full DSA/competitive-programming learning product, built in phases.
- V1 remains bounded rather than attempting every topic at once.
- Initial language set: C++, Java, Python, and JavaScript.
- V1 snippet support: documented canonical patterns with validation, not arbitrary program execution.
- Explanations: deterministic and generated from trace events; no mandatory LLM dependency.
- Initial implementation stack: client-only React, TypeScript, and Vite.
- Initial algorithm scope: array operations, two-pointer patterns, and common sorting algorithms.
