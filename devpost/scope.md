---
doc: scope
status: approved
---

# AlgoLens

AlgoLens helps a learner understand a LeetCode solution by stepping through a supported method and seeing how its state changes.

## The Unique Kernel

Instead of requiring a `main` method or showing only a canned animation, AlgoLens lets the learner focus on a selected LeetCode-style method, provide its inputs, and step through supported execution with the changing values made visible.

## Who It's For

First, it is for its maker: a student who solves LeetCode problems in Java and wants to understand how a solution works, not just whether it returns the expected answer. Today, that means reading the code and trying to reason about its execution manually.

## The Core Loop

Open AlgoLens, paste or choose a solution, select the method, provide inputs, and run it. Step forward or backward through the supported execution while following the code, variable and array state, and plain-English explanation. Return to the loop with another method or input.

## Inspiration & Identity

The product should feel like a focused learning workbench rather than a generic generated demo: clear code and trace views, deliberate visual hierarchy, dark mode, and layouts that work on a phone as well as a laptop. No external visual reference has been chosen.

## Why This Matters to the Learner

“I’m building this for myself to understand the code well.” Entering the hackathon is also a chance to submit the project and possibly win; that is the reason to submit, not a substitute for the learning problem the app solves.

## What "Working" Looks Like

The learner pastes a LeetCode-style Java method such as binary search or `lowerBound`, without writing a `main` method, selects the detected method, supplies test inputs, and runs it. The learner can then move through the supported execution and see the relevant code, state changes, and explanations stay in step. That is the proof: the method's behavior becomes easier to follow than by reading it alone.

## The POC Boundary

Prove one end-to-end learning loop in the local web app: choose or paste a supported Java method, provide inputs, run it, and inspect its steps. Keep the demonstration centered on supported array and binary-search examples. Be explicit about the supported Java subset; do not imply that arbitrary LeetCode code is understood or visualized.

## Later

- Broader Java syntax and more LeetCode methods, including carefully bounded string cases.
- More languages and DSA topics beyond the existing supported examples.
- Optional AI-generated explanations, only if they can stay grounded in the actual trace.
- Accounts, saved sessions, sharing, and hosted execution.

## Explicitly Cut

- Claiming support for every Java or LeetCode solution: the first proof should stay within tested execution and trace limits.
- Requiring the learner to add a `main` method: the target interaction is selecting and running the solution method itself.
- A required cloud AI service, login, or backend: none is needed to demonstrate the local learning loop.
- Treating a hackathon prize as the app's user problem: the product is for understanding code; the competition is a submission opportunity.
