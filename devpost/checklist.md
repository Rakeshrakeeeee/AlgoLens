---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast (learner requested completion as soon as possible)

## Slices

- [x] **1. You can step through an actual run and read an evidence-based explanation**
  Becomes usable: Code execution displays a short plain-English explanation for the selected actual runtime event, synchronized with the source line and state. It explains only supported, provable changes and explicitly declines unsupported causes.
  Why now: This is the core learning promise in the approved PRD that the current runtime UI does not yet fulfill; it should be implemented and tested before improving setup convenience.
  PRD ref: `prd.md > Running a supported method`, `prd.md > Explaining errors and limits`
  Spec ref: `spec.md > Components` (Runtime explanation helper and Actual execution panel), `spec.md > Important Failure Modes`, `spec.md > Decisions and Open Issues`
  Build: Add a typed explanation helper that compares the current and previous trace events and reads source conditions only through an explicit safe grammar; never evaluate submitted source. Add a synchronized explanation area to the execution panel. Cover supported explanations, ambiguous/unsupported conditions, missing trace context, and boundary steps with tests.
  Verify (mechanical): Run `npm test` and `npm run build`; verify tests include both a supported condition explanation and a clear fallback for unsupported expressions.
  Learner check: Run the supplied Java array method or another supported sample, step forward and backward, and check that the explanation follows the selected source line and values without claiming more than the trace shows.
  Commit: `Add evidence-based runtime explanations`

- [x] **2. You can start the app with one command**
  Becomes usable: One command starts the local web UI and loopback runner together, prints the app URL, and shuts both down on Ctrl+C; missing Docker leaves simulation usable and never runs code on the host.
  Why now: Once the core learning journey is understandable, remove two-terminal setup friction without changing the stack or safety boundary.
  PRD ref: `prd.md > The Core Journey`, `prd.md > States and Boundaries`
  Spec ref: `spec.md > Where It Runs and How Someone Tries It`, `spec.md > Components` (Local startup coordinator), `spec.md > Important Failure Modes`
  Build: Add the Node built-in launcher and package script. Start the runner and Vite, wait for the local API to answer even if Docker is offline, forward process output, report startup errors, and clean up both child processes on exit. Update README run instructions to prefer the single command while retaining troubleshooting details.
  Verify (mechanical): Run `npm test` and `npm run build`; with defaults occupied, start `npm run start:local`, confirm it serves Vite on 5174 and runner health on 8766, confirm `/api/trace` returns a Java trace through the proxy, then send Ctrl+C/SIGINT and confirm both service ports close. Do not stop Docker solely to simulate its absence.
  Learner check: From the project folder, run `npm run start:local`, open the printed URL, try Pattern simulation, then stop with Ctrl+C. If Docker is available, also run a supported code example.
  Commit: `Add one-command local startup`

## Hands-on Checkpoints

- [ ] Early usable behavior explored — after slice 1; agent smoke-tested the live Java trace and explanation, but the learner delegated their own review, so personal feedback remains outstanding.
- [ ] Final kick-the-tires exploration and feedback completed — the agent tested the live app and Java trace; the learner delegated their own review, so final learner feedback and ready-to-ship confirmation are outstanding.

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [x] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: Agent ran the live app and a Java loop trace through the local sandbox; 52 frontend tests and the production build passed. The learner delegated review, so no learner-led tour is claimed.
Route and stops: Reference route only — `src/ExecutionPanel.tsx > runCode()`, `runner/server.py > Handler.do_POST()/run_in_sandbox()`, and `src/execution-explanations.ts > describeRuntimeStep()/explainSkippedJavaLoop()`. Not interactively toured by the learner.
Edit outcome: No optional learning edit offered or attempted; only planned implementation changes were made.
Reflection: Not offered; personal reflection remains outstanding and belongs in the ignored learner profile.
Activity mode: Agent-run live app and editor verification plus offline HTML map preview; learner walkthrough outstanding.

## Revisions

- Java JDI can omit a control-header line from its captured line events; the explanation helper checks only the bounded source lines between adjacent events for an allowlisted loop form, then evaluates its simple condition from captured inputs. Added unit and live-container coverage.
- Clearing the optional expected-result field now skips comparison instead of reporting invalid JSON; this surfaced while verifying the Java loop example.
- The default development ports were already in use by the open app, so the launcher was verified using its supported fallback ports (5174 for Vite and 8766 for the local runner); Vite's proxy now uses the selected runner port.
