---
doc: prd
status: approved
---

# AlgoLens — Product Requirements

AlgoLens is a learning workbench for a student who wants to understand how a supported LeetCode-style method changes its state while it runs. It builds on [scope.md > Who It's For], [scope.md > The Core Loop], and [scope.md > The POC Boundary].

## The Core Journey

1. The learner opens AlgoLens and chooses either **Code execution** to inspect a supported method's actual run or **Pattern simulation** to see a modeled example of a recognized algorithm.
2. In Code execution, the learner pastes a supported Java method without adding a `main` method. AlgoLens identifies the method and lets the learner provide its inputs.
3. The learner runs the method. The workbench shows the relevant code, execution state, and a plain-English explanation together.
4. The learner uses playback controls to move through the trace, including backward and forward, and sees the code position, values, and explanation update for the selected step.
5. The learner changes the method or inputs and runs it again to understand another case. If the current code or inputs cannot be handled, AlgoLens explains the limitation or error rather than presenting an old trace as the result of the new run.

This develops [scope.md > The Core Loop] and makes its Java-method learning outcome observable.

## Screens and Layout

AlgoLens is a focused workbench, not a sequence of setup screens. It has a code/input area, a visualization area, playback controls, and an explanation log. Code execution and Pattern simulation are clearly distinguishable modes so learners know whether they are seeing a real run or a modeled trace.

On a laptop, the code and input area sits alongside the visualization and explanation log. On a phone or narrow screen, these areas stack into a readable order, with playback controls easy to reach. This carries forward [scope.md > Inspiration & Identity].

## Look and Feel

Use a focused learning-workbench style with clear hierarchy rather than generic AI-chat styling. Support dark mode and layouts that remain usable on phones and laptops. No external visual reference or specific font has been chosen. Source: [scope.md > Inspiration & Identity].

## Features and Behavior

### Running a supported method

Develops [scope.md > The Unique Kernel] and [scope.md > What "Working" Looks Like].

- The learner can paste a supported Java solution method without writing a `main` method.
- AlgoLens identifies the method to run and provides a way to supply its required inputs. The method name and variable names are not fixed to one hard-coded example.
- A successful run produces a step-by-step trace of the actual supported execution. The learner can move forward, backward, play, and pause.
- At each step, the selected code location, relevant variable/array state, and plain-English explanation stay in sync.
- A run that exposes a clear behavior such as a loop not entering because its starting index is already beyond the array's last index should show the observed state and explain that cause in simple language.
- AlgoLens does not promise to find every possible logic bug. It explains only what it can ground in the supported execution and observed state.

### Showing a pattern simulation

Develops [scope.md > The POC Boundary].

- Pattern simulation provides a modeled trace for a pattern it confidently recognizes; it does not execute the pasted source code.
- The mode labels its output as a simulation, so a standard modeled trace cannot be mistaken for the exact behavior of an edited method.
- If no supported pattern is confidently recognized, show a clear message such as: “Pattern not recognized. I couldn't confidently recognize this solution yet. Try a standard array sort or two-pointer pattern; your code is never executed.”
- Editing code or starting inputs, or encountering a failed run, must not leave an old trace looking like the result of the current code.

### Explaining errors and limits

Develops [scope.md > The POC Boundary] and [scope.md > What "Working" Looks Like].

- When a supported run has a syntax, input, or runtime problem, show an understandable explanation tied to that attempt.
- When AlgoLens cannot explain a suspected logic bug confidently, it says why it cannot—for example, the construct is unsupported or the expected behavior is not clear—instead of claiming a diagnosis.
- A failed or unsupported attempt must not silently appear successful or display stale trace data as if it came from the attempt.

## States and Boundaries

- **First use** — The learner can tell which mode runs their code and which mode shows a modeled trace.
- **No usable method or inputs** — Explain what is missing or unsupported and what the learner can change; do not show a prior run as current.
- **Successful execution** — Show actual supported steps, state, and explanations with playback controls.
- **Recognized pattern simulation** — Show a clearly labeled modeled trace, not an execution claim.
- **Unrecognized pattern** — Explain that the pattern was not confidently recognized and that the code was not executed.
- **Unsupported or failed execution** — Explain the observed error or the specific reason the attempt could not be handled. Do not promise a diagnosis for every logic bug.
- **After editing or rerunning** — The trace and explanation correspond to the latest code and inputs, or are clearly marked unavailable until a new run succeeds.
- **Persistence** — The POC does not require accounts or saved sessions; a run is for the current workbench session.

## Product Decisions

- The learner wants AlgoLens to adapt to different method names, variable names, and inputs rather than depend on one hard-coded method.
- The learner chose to keep Pattern simulation, provided its modeled output is clearly identified as a simulation and never described as execution of the pasted code.
- The learner wants actual supported execution to explain observable causes of unexpected behavior in simple language, such as a loop that never starts because its initial index is beyond the array.
- The learner wants AlgoLens to state why it cannot diagnose an issue when it lacks enough information or does not support the code; it must not claim to detect every possible logic bug.
- The POC remains centered on the Java method, array, and binary-search learning loop in the approved scope. The project's broader ambition to support more languages, syntax, and problem types is deferred.

## What We're Building

- One end-to-end local workbench for pasting a supported Java method, providing inputs, running it without a user-authored `main`, and inspecting its actual supported steps.
- Playback controls and synchronized code, state, and plain-English explanations.
- Clearly distinguished pattern simulation for recognized examples, including an explicit non-recognition message when the pasted code does not match a supported pattern.
- Understandable, evidence-based explanations for supported execution errors and observable behavior, plus explicit reasons when a run or diagnosis is unsupported.
- A responsive interface with dark mode, as described in [scope.md > Inspiration & Identity].

## Deferred From the POC

- Reliable diagnosis of every possible logic bug — too broad to promise for a bounded proof of concept; the POC explains only causes supported by its observed execution.
- General execution of arbitrary Java or every LeetCode submission — the POC is limited to a tested subset so that its traces and explanations can be trusted.
- Broader language, syntax, string-problem, and DSA coverage — these expand the execution and validation surface beyond the focused array and binary-search proof.
- AI-generated explanations that are not grounded in the actual trace — correctness and learner trust come first.
- Accounts, saved sessions, sharing, and hosted execution — unnecessary for demonstrating the local learning loop.

## Possible Later Enhancements

Expand the tested execution subset and add carefully bounded string and additional DSA examples. Explore AI-assisted explanations only where they can be checked against the real trace.

## Non-Goals

- Claiming that Pattern simulation executes the pasted source — it shows a modeled example only.
- Claiming that AlgoLens understands or debugs every Java or LeetCode solution — support is bounded and communicated clearly.
- Requiring a user-written `main` method — the learner's goal is to focus on the solution method.
- Requiring a cloud AI service, login, or backend for the local proof of concept.
- Treating a potential hackathon prize as the product's user problem.

## Open Questions

- The exact Java syntax and constructs supported by the execution tracer are implementation details for `4-spec`; the learner-facing boundary must remain explicit.
- The trace evidence required before explaining a logic issue can be pinned down in `4-spec` against the supported examples.
