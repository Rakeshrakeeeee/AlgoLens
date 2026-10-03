import { describe, expect, it } from "vitest";
import { describeRuntimeStep, type RuntimeEvent } from "./execution-explanations";

function event(overrides: Partial<RuntimeEvent> = {}): RuntimeEvent {
  return {
    sequence: 0,
    kind: "line",
    line: 1,
    function: "solve",
    frameId: 1,
    parentFrameId: null,
    locals: {},
    heap: [],
    ...overrides,
  };
}

describe("runtime step explanations", () => {
  it("explains entry and provides a useful empty state", () => {
    expect(describeRuntimeStep("")).toContain("Run a supported method");
    expect(describeRuntimeStep("", event({ kind: "call" }))).toContain("Execution entered solve()");
  });

  it("describes captured variable and array changes without inventing intent", () => {
    const previous = event({
      locals: { index: 0, values: { $ref: "a" } },
      heap: [{ id: "a", type: "list", kind: "sequence", items: [1, 2] }],
    });
    const current = event({
      line: 2,
      sequence: 1,
      locals: { index: 1, values: { $ref: "a" } },
      heap: [{ id: "a", type: "list", kind: "sequence", items: [1, 2] }],
    });
    const explanation = describeRuntimeStep("index += 1\nprint(index)", current, previous);
    expect(explanation).toContain("index changed from 0 to 1");
    expect(explanation).not.toContain("because");
  });

  it("explains a Java loop skipped by an initially false, supported length check", () => {
    const source = [
      "class Solution {",
      "  void solve(int[] nums) {",
      "    int count = 0;",
      "    for (int i = 1; i < nums.length; i++) {",
      "      count++;",
      "    }",
      "    return count;",
      "  }",
      "}",
    ].join("\n");
    const previous = event({
      line: 3,
      locals: { count: 0, nums: { $ref: "nums" } },
      heap: [{ id: "nums", type: "int[]", kind: "sequence", items: [] }],
    });
    const current = event({ line: 7, sequence: 1, locals: previous.locals, heap: previous.heap });
    const explanation = describeRuntimeStep(source, current, previous);
    expect(explanation).toContain("i starts at 1");
    expect(explanation).toContain("nums.length (0) is false");
  });

  it("explains an empty Python iterable only when the next line leaves its block", () => {
    const source = "def solve(values):\n    for value in values:\n        use(value)\n    finish()";
    const previous = event({
      line: 2,
      locals: { values: { $ref: "values" } },
      heap: [{ id: "values", type: "list", kind: "sequence", items: [] }],
    });
    const after = event({ line: 4, sequence: 1, locals: previous.locals, heap: previous.heap });
    expect(describeRuntimeStep(source, after, previous)).toContain("values is empty");
    const inside = event({ line: 3, sequence: 1, locals: previous.locals, heap: previous.heap });
    expect(describeRuntimeStep(source, inside, previous)).not.toContain("loop body was skipped");
  });

  it("does not evaluate or infer unsupported conditions", () => {
    const source = "for (int i = dangerous(); i < nums.length; i++) {\n  use(i);\n}";
    const previous = event({
      line: 1,
      locals: { nums: { $ref: "nums" } },
      heap: [{ id: "nums", type: "int[]", kind: "sequence", items: [] }],
    });
    const current = event({ line: 3, sequence: 1, locals: previous.locals, heap: previous.heap });
    const explanation = describeRuntimeStep(source, current, previous);
    expect(explanation).toContain("No supported local-value change was detected");
    expect(explanation).not.toContain("skipped");
  });

  it("limits claims at exceptions and call-frame changes", () => {
    const prior = event();
    expect(describeRuntimeStep("", event({ kind: "exception", line: 4 }), prior)).toContain("See the error message");
    expect(describeRuntimeStep("", event({ frameId: 2 }), prior)).toContain("different call frame");
  });
});
