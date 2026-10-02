import { describe, expect, it } from "vitest";
import {
  algorithms,
  createTrace,
  detectAlgorithm,
  findSyntaxErrorLine,
  getDecisionInsight,
  mapTraceToSourceLines,
  MAX_SOURCE_LENGTH,
  snippets,
  type Language,
} from "./engine";

describe("algorithm pattern recognition", () => {
  it.each(algorithms.flatMap((algorithm) =>
    (Object.keys(snippets[algorithm.id]) as Language[]).map((language) => ({
      name: `${algorithm.name} / ${language}`,
      source: snippets[algorithm.id][language],
      expected: algorithm.id,
    })),
  ))("recognizes built-in template: $name", ({ source, expected }) => {
    expect(detectAlgorithm(source)).toBe(expected);
  });

  it.each([
    {
      language: "Python",
      source: `class Solution:
    def twoSum(self, numbers, target):
        l, r = 0, len(numbers) - 1
        while l < r:
            current = numbers[l] + numbers[r]
            if current == target:
                return [l, r]
            if current < target:
                l += 1
            else:
                r -= 1`,
      expected: "pair-sum",
    },
    {
      language: "Java",
      source: `class Solution {
  void selectionSort(int[] numbers) {
    for (int start=0; start<numbers.length; start++) {
      int smallest=start;
      for(int scan=start+1; scan<numbers.length; scan++) {
        if(numbers[scan] < numbers[smallest]) smallest=scan;
      }
      int temp=numbers[start]; numbers[start]=numbers[smallest]; numbers[smallest]=temp;
    }
  }
}`,
      expected: "selection-sort",
    },
    {
      language: "C++",
      source: `class Solution {
 public:
  int removeDuplicates(vector<int>& nums) {
    int i=0;
    for (int j=1; j<nums.size(); j++) {
      if(nums[j]!=nums[i]) nums[++i]=nums[j];
    }
    return i+1;
  }
};`,
      expected: "remove-duplicates",
    },
    {
      language: "Python",
      source: `class Solution:
 def reverse(self, nums):
  left, right = 0, len(nums)-1
  while left < right:
   nums[left], nums[right] = nums[right], nums[left]
   left += 1
   right -= 1
  return nums`,
      expected: "reverse",
    },
  ])("recognizes a LeetCode-style $language submission", ({ source, expected }) => {
    expect(detectAlgorithm(source)).toBe(expected);
  });

  it("does not claim support for an unrecognized algorithm", () => {
    expect(detectAlgorithm("class Solution { int search(int[] a) { return binarySearch(a); } }")).toBeNull();
  });

  it("rejects source exceeding the analysis size bound", () => {
    expect(detectAlgorithm(" ".repeat(MAX_SOURCE_LENGTH + 1))).toBeNull();
  });
});

describe("deterministic trace and Decision Lens", () => {
  it("produces a complete sorted trace and a rationale for the active comparison", () => {
    const trace = createTrace("bubble-sort", [4, 1, 3], 0);
    expect(trace.at(-1)?.values).toEqual([1, 3, 4]);
    expect(trace.at(-1)?.kind).toBe("done");
    expect(getDecisionInsight(trace[1], "bubble-sort", 0)).toContain("swapping");
  });

  it("explains the monotonic reason for moving a pair-sum pointer", () => {
    const trace = createTrace("pair-sum", [1, 2, 4, 9], 11);
    const insight = getDecisionInsight(trace[1], "pair-sum", 11);
    expect(insight).toContain("below 11");
    expect(insight).toContain("left pointer");
  });

  it("traces binary search with the shrinking bounds and active middle index", () => {
    const trace = createTrace("binary-search", [1, 3, 5, 7, 9, 11], 7);
    const comparisons = trace.filter((step) => step.kind === "compare");
    expect(comparisons.map((step) => step.pointers.mid)).toEqual([2, 4, 3]);
    expect(comparisons[0].variables).toMatchObject({ left: 0, right: 5, target: 7, value: 5 });
    expect(getDecisionInsight(comparisons[0], "binary-search", 7)).toContain("search the right half");
    expect(trace.at(-1)).toMatchObject({ kind: "done", highlighted: [3] });
    expect(trace.at(-1)?.variables.result).toBe(3);
  });

  it("explains a binary-search miss and rejects unsorted input", () => {
    const trace = createTrace("binary-search", [1, 3, 5, 7, 9], 4);
    expect(trace.at(-1)?.explanation).toContain("not in the array");
    expect(trace.at(-1)?.variables.result).toBe(-1);
    expect(() => createTrace("binary-search", [3, 1, 5], 1)).toThrow("needs a sorted array");
  });

  it("maps binary-search comparisons and bound changes to source lines", () => {
    const source = snippets["binary-search"].java;
    const trace = mapTraceToSourceLines(createTrace("binary-search", [1, 3, 5, 7, 9, 11], 7), source, "binary-search");
    expect(trace.find((step) => step.kind === "compare")?.line).toBe(5);
    expect(trace.find((step) => step.kind === "move")?.line).toBe(6);
  });

  it("snapshots local variables, temporary values, and array heap changes", () => {
    const trace = createTrace("reverse", [3, 1], 0);
    const temporary = trace.find((step) => step.variables.temp === 3);
    expect(temporary?.heap[0].address).toBe("@A1");
    expect(temporary?.heap[0].values).toEqual([3, 1]);
    const swapped = trace.find((step) => step.kind === "swap");
    expect(swapped?.heap[0].values).toEqual([1, 3]);
    expect(swapped?.variables.left).toBe(0);
  });

  it("maps modelled events to matching lines in a LeetCode wrapper", () => {
    const source = `class Solution {
  vector<int> twoSum(vector<int>& nums, int target) {
    int left = 0, right = nums.size() - 1;
    while (left < right) {
      int sum = nums[left] + nums[right];
      if (sum == target) return {left, right};
      if (sum < target) left++;
      else right--;
    }
    return {};
  }
}`;
    const trace = mapTraceToSourceLines(createTrace("pair-sum", [1, 2, 4, 9], 11), source, "pair-sum");
    expect(trace[1].line).toBe(5);
    expect(trace[2].line).toBe(7);
  });

  it("reports the line with an unmatched delimiter", () => {
    expect(findSyntaxErrorLine("int f() {\n  return 1;\n", "cpp")).toBe(1);
    expect(findSyntaxErrorLine("def f(a):\n    return a[0]\n", "python")).toBeNull();
  });
});
