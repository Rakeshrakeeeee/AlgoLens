export type Language = "cpp" | "java" | "python" | "javascript";

export type AlgorithmId =
  | "bubble-sort"
  | "selection-sort"
  | "insertion-sort"
  | "reverse"
  | "pair-sum"
  | "binary-search"
  | "palindrome"
  | "remove-duplicates";

export const MAX_SOURCE_LENGTH = 12_000;

export type Step = {
  values: number[];
  variables: Record<string, number | string>;
  heap: { address: string; type: string; values: number[] }[];
  pointers: Record<string, number>;
  highlighted: number[];
  line: number;
  kind: "start" | "compare" | "move" | "swap" | "write" | "done";
  explanation: string;
};

export type Algorithm = {
  id: AlgorithmId;
  name: string;
  category: string;
  description: string;
  complexity: string;
  icon: string;
};

export const algorithms: Algorithm[] = [
  { id: "bubble-sort", name: "Bubble sort", category: "SORTING", description: "Repeatedly compare neighbors and bubble the largest value to the end.", complexity: "O(n²)", icon: "↕" },
  { id: "selection-sort", name: "Selection sort", category: "SORTING", description: "Find the smallest remaining value and place it in its final position.", complexity: "O(n²)", icon: "⌄" },
  { id: "insertion-sort", name: "Insertion sort", category: "SORTING", description: "Grow a sorted section by inserting each next value into the right spot.", complexity: "O(n²)", icon: "↳" },
  { id: "reverse", name: "Reverse an array", category: "TWO POINTERS", description: "Move inward from both ends, swapping values until the pointers meet.", complexity: "O(n)", icon: "⇄" },
  { id: "pair-sum", name: "Pair sum", category: "TWO POINTERS", description: "Search a sorted array by moving the pointer that can improve the sum.", complexity: "O(n)", icon: "⌕" },
  { id: "binary-search", name: "Binary search", category: "SEARCHING", description: "Halve the sorted search range each step until the target is found or ruled out.", complexity: "O(log n)", icon: "⌖" },
  { id: "palindrome", name: "Palindrome check", category: "TWO POINTERS", description: "Compare matching values from the outside, moving toward the center.", complexity: "O(n)", icon: "◇" },
  { id: "remove-duplicates", name: "Remove duplicates", category: "TWO POINTERS", description: "Compact a sorted array in place with slow and fast pointers.", complexity: "O(n)", icon: "⊖" },
];

type SnippetSet = Record<AlgorithmId, Record<Language, string>>;

export const snippets: SnippetSet = {
  "bubble-sort": {
    javascript: "function bubbleSort(a) {\n  for (let i = 0; i < a.length; i++) {\n    for (let j = 0; j < a.length - i - 1; j++) {\n      if (a[j] > a[j + 1]) {\n        [a[j], a[j + 1]] = [a[j + 1], a[j]];\n      }\n    }\n  }\n  return a;\n}",
    python: "def bubble_sort(a):\n    for i in range(len(a)):\n        for j in range(len(a) - i - 1):\n            if a[j] > a[j + 1]:\n                a[j], a[j + 1] = a[j + 1], a[j]\n    return a",
    java: "void bubbleSort(int[] a) {\n  for (int i = 0; i < a.length; i++) {\n    for (int j = 0; j < a.length - i - 1; j++) {\n      if (a[j] > a[j + 1]) {\n        int t = a[j]; a[j] = a[j + 1]; a[j + 1] = t;\n      }\n    }\n  }\n}",
    cpp: "void bubbleSort(vector<int>& a) {\n  for (int i = 0; i < a.size(); i++) {\n    for (int j = 0; j < a.size() - i - 1; j++) {\n      if (a[j] > a[j + 1]) swap(a[j], a[j + 1]);\n    }\n  }\n}",
  },
  "selection-sort": {
    javascript: "function selectionSort(a) {\n  for (let i = 0; i < a.length; i++) {\n    let min = i;\n    for (let j = i + 1; j < a.length; j++) {\n      if (a[j] < a[min]) min = j;\n    }\n    [a[i], a[min]] = [a[min], a[i]];\n  }\n  return a;\n}",
    python: "def selection_sort(a):\n    for i in range(len(a)):\n        min_index = i\n        for j in range(i + 1, len(a)):\n            if a[j] < a[min_index]: min_index = j\n        a[i], a[min_index] = a[min_index], a[i]\n    return a",
    java: "void selectionSort(int[] a) {\n  for (int i = 0; i < a.length; i++) {\n    int min = i;\n    for (int j = i + 1; j < a.length; j++) {\n      if (a[j] < a[min]) min = j;\n    }\n    int t = a[i]; a[i] = a[min]; a[min] = t;\n  }\n}",
    cpp: "void selectionSort(vector<int>& a) {\n  for (int i = 0; i < a.size(); i++) {\n    int min = i;\n    for (int j = i + 1; j < a.size(); j++) {\n      if (a[j] < a[min]) min = j;\n    }\n    swap(a[i], a[min]);\n  }\n}",
  },
  "insertion-sort": {
    javascript: "function insertionSort(a) {\n  for (let i = 1; i < a.length; i++) {\n    let key = a[i];\n    let j = i - 1;\n    while (j >= 0 && a[j] > key) {\n      a[j + 1] = a[j]; j--;\n    }\n    a[j + 1] = key;\n  }\n  return a;\n}",
    python: "def insertion_sort(a):\n    for i in range(1, len(a)):\n        key = a[i]\n        j = i - 1\n        while j >= 0 and a[j] > key:\n            a[j + 1] = a[j]\n            j -= 1\n        a[j + 1] = key\n    return a",
    java: "void insertionSort(int[] a) {\n  for (int i = 1; i < a.length; i++) {\n    int key = a[i], j = i - 1;\n    while (j >= 0 && a[j] > key) { a[j + 1] = a[j]; j--; }\n    a[j + 1] = key;\n  }\n}",
    cpp: "void insertionSort(vector<int>& a) {\n  for (int i = 1; i < a.size(); i++) {\n    int key = a[i], j = i - 1;\n    while (j >= 0 && a[j] > key) { a[j + 1] = a[j]; j--; }\n    a[j + 1] = key;\n  }\n}",
  },
  reverse: {
    javascript: "function reverse(a) {\n  let left = 0, right = a.length - 1;\n  while (left < right) {\n    [a[left], a[right]] = [a[right], a[left]];\n    left++; right--;\n  }\n  return a;\n}",
    python: "def reverse(a):\n    left, right = 0, len(a) - 1\n    while left < right:\n        a[left], a[right] = a[right], a[left]\n        left += 1\n        right -= 1\n    return a",
    java: "void reverse(int[] a) {\n  int left = 0, right = a.length - 1;\n  while (left < right) {\n    int t = a[left]; a[left] = a[right]; a[right] = t;\n    left++; right--;\n  }\n}",
    cpp: "void reverse(vector<int>& a) {\n  int left = 0, right = a.size() - 1;\n  while (left < right) {\n    swap(a[left], a[right]);\n    left++; right--;\n  }\n}",
  },
  "pair-sum": {
    javascript: "function pairSum(a, target) {\n  let left = 0, right = a.length - 1;\n  while (left < right) {\n    const sum = a[left] + a[right];\n    if (sum === target) return [left, right];\n    if (sum < target) left++; else right--;\n  }\n  return [];\n}",
    python: "def pair_sum(a, target):\n    left, right = 0, len(a) - 1\n    while left < right:\n        total = a[left] + a[right]\n        if total == target: return [left, right]\n        if total < target: left += 1\n        else: right -= 1\n    return []",
    java: "int[] pairSum(int[] a, int target) {\n  int left = 0, right = a.length - 1;\n  while (left < right) {\n    int sum = a[left] + a[right];\n    if (sum == target) return new int[]{left, right};\n    if (sum < target) left++; else right--;\n  }\n  return new int[]{};\n}",
    cpp: "vector<int> pairSum(vector<int>& a, int target) {\n  int left = 0, right = a.size() - 1;\n  while (left < right) {\n    int sum = a[left] + a[right];\n    if (sum == target) return {left, right};\n    if (sum < target) left++; else right--;\n  }\n  return {};\n}",
  },
  "binary-search": {
    javascript: "function binarySearch(a, target) {\n  let left = 0, right = a.length - 1;\n  while (left <= right) {\n    const mid = Math.floor((left + right) / 2);\n    if (a[mid] === target) return mid;\n    if (a[mid] < target) left = mid + 1;\n    else right = mid - 1;\n  }\n  return -1;\n}",
    python: "def binary_search(a, target):\n    left, right = 0, len(a) - 1\n    while left <= right:\n        mid = (left + right) // 2\n        if a[mid] == target:\n            return mid\n        if a[mid] < target:\n            left = mid + 1\n        else:\n            right = mid - 1\n    return -1",
    java: "int binarySearch(int[] a, int target) {\n  int left = 0, right = a.length - 1;\n  while (left <= right) {\n    int mid = left + (right - left) / 2;\n    if (a[mid] == target) return mid;\n    if (a[mid] < target) left = mid + 1;\n    else right = mid - 1;\n  }\n  return -1;\n}",
    cpp: "int binarySearch(vector<int>& a, int target) {\n  int left = 0, right = a.size() - 1;\n  while (left <= right) {\n    int mid = left + (right - left) / 2;\n    if (a[mid] == target) return mid;\n    if (a[mid] < target) left = mid + 1;\n    else right = mid - 1;\n  }\n  return -1;\n}",
  },
  palindrome: {
    javascript: "function isPalindrome(a) {\n  let left = 0, right = a.length - 1;\n  while (left < right) {\n    if (a[left] !== a[right]) return false;\n    left++; right--;\n  }\n  return true;\n}",
    python: "def is_palindrome(a):\n    left, right = 0, len(a) - 1\n    while left < right:\n        if a[left] != a[right]: return False\n        left += 1\n        right -= 1\n    return True",
    java: "boolean isPalindrome(int[] a) {\n  int left = 0, right = a.length - 1;\n  while (left < right) {\n    if (a[left] != a[right]) return false;\n    left++; right--;\n  }\n  return true;\n}",
    cpp: "bool isPalindrome(vector<int>& a) {\n  int left = 0, right = a.size() - 1;\n  while (left < right) {\n    if (a[left] != a[right]) return false;\n    left++; right--;\n  }\n  return true;\n}",
  },
  "remove-duplicates": {
    javascript: "function removeDuplicates(a) {\n  if (!a.length) return 0;\n  let slow = 0;\n  for (let fast = 1; fast < a.length; fast++) {\n    if (a[fast] !== a[slow]) {\n      slow++; a[slow] = a[fast];\n    }\n  }\n  return slow + 1;\n}",
    python: "def remove_duplicates(a):\n    if not a: return 0\n    slow = 0\n    for fast in range(1, len(a)):\n        if a[fast] != a[slow]:\n            slow += 1\n            a[slow] = a[fast]\n    return slow + 1",
    java: "int removeDuplicates(int[] a) {\n  if (a.length == 0) return 0;\n  int slow = 0;\n  for (int fast = 1; fast < a.length; fast++) {\n    if (a[fast] != a[slow]) a[++slow] = a[fast];\n  }\n  return slow + 1;\n}",
    cpp: "int removeDuplicates(vector<int>& a) {\n  if (a.empty()) return 0;\n  int slow = 0;\n  for (int fast = 1; fast < a.size(); fast++) {\n    if (a[fast] != a[slow]) a[++slow] = a[fast];\n  }\n  return slow + 1;\n}",
  },
};

export function normalizeCode(source: string, language: Language): string {
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/(?!\s*\d).*$/gm, "")
    .replace(language === "python" ? /#.*$/gm : /$^/gm, "");
  return withoutComments.replace(/\s+/g, "").trim();
}

export function validateSnippet(source: string, algorithm: AlgorithmId, language: Language): boolean {
  return normalizeCode(source, language) === normalizeCode(snippets[algorithm][language], language);
}

export function detectAlgorithm(source: string): AlgorithmId | null {
  if (source.length > MAX_SOURCE_LENGTH) return null;
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/(?!\s*\d).*$/gm, "")
    .replace(/#.*$/gm, "")
    .replace(/(['"`])(?:\\.|(?!\1)[^\\])*\1/g, "")
    .replace(/\s+/g, "")
    .toLowerCase()
    .replace(/len\((\w+)\)/g, "$1.length");
  const hasLoop = /(?:while|for)/.test(code);
  const forLoopCount = code.match(/for(?=\(|[a-z_])/g)?.length ?? 0;
  const hasIndexedValues = /\w+\[\w+\]/.test(code);
  const twoPointerLoop = code.match(/while\(?(\w+)<(\w+)\)?/);
  const leftPointer = twoPointerLoop?.[1];
  const rightPointer = twoPointerLoop?.[2];
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pointerMovesInward = leftPointer && rightPointer
    && new RegExp(`${escape(leftPointer)}(?:\\+\\+|\\+=1)`).test(code)
    && new RegExp(`${escape(rightPointer)}(?:--|-=1)`).test(code);
  const compactWrite = code.match(/([a-z_$]\w*)\[(?:\+\+)?([a-z_$]\w*)\]=([a-z_$]\w*)\[([a-z_$]\w*)\]/);

  if (hasLoop && compactWrite && compactWrite[1] === compactWrite[3]
    && new RegExp(`${escape(compactWrite[1])}\\[${escape(compactWrite[4])}\\](?:!==|!=)${escape(compactWrite[1])}\\[${escape(compactWrite[2])}\\]`).test(code)
    && new RegExp(`(?:\\+\\+)?${escape(compactWrite[2])}(?:\\+\\+|\\+=1|\\+1)`).test(code)) {
    return "remove-duplicates";
  }
  const middleChecks = [...code.matchAll(/\w+\[([a-z_$]\w*)\](?:===|==|!=|!==|<|>)target/g)];
  const binarySearch = middleChecks.find((match) => {
    const middleIndex = match[1];
    if (!new RegExp(`(?:let|var|const|int|long)?${escape(middleIndex)}=[^;{}]{0,80}\\/2`).test(code)) return false;
    const movesRight = [...code.matchAll(new RegExp(`([a-z_$]\\w*)=${escape(middleIndex)}\\+1`, "g"))];
    const movesLeft = [...code.matchAll(new RegExp(`([a-z_$]\\w*)=${escape(middleIndex)}-1`, "g"))];
    return movesRight.some((rightMove) => movesLeft.some((leftMove) => rightMove[1] !== leftMove[1]));
  });
  if (hasLoop && binarySearch) return "binary-search";
  if (hasLoop && leftPointer && rightPointer && pointerMovesInward
    && new RegExp(`\\w+\\[${escape(leftPointer)}\\]\\+\\w+\\[${escape(rightPointer)}\\]`).test(code)
    && /target/.test(code)) {
    return "pair-sum";
  }
  if (hasLoop && leftPointer && rightPointer && pointerMovesInward
    && new RegExp(`\\w+\\[${escape(leftPointer)}\\](?:!==?|==)\\w+\\[${escape(rightPointer)}\\]`).test(code)
    && /return(?:false|0)/.test(code)) {
    return "palindrome";
  }
  if (hasLoop && leftPointer && rightPointer && pointerMovesInward
    && (new RegExp(`swap\\(\\w+\\[${escape(leftPointer)}\\],\\w+\\[${escape(rightPointer)}\\]\\)`).test(code)
      || new RegExp(`\\[\\w+\\[${escape(leftPointer)}\\],\\w+\\[${escape(rightPointer)}\\]\\]=`).test(code)
      || new RegExp(`\\w+\\[${escape(leftPointer)}\\],\\w+\\[${escape(rightPointer)}\\]=`).test(code)
      || new RegExp(`\\w+\\[${escape(leftPointer)}\\]=\\w+\\[${escape(rightPointer)}\\]`).test(code))) {
    return "reverse";
  }
  if (hasLoop && /(?:key|current|value)=\w+\[\w+\]/.test(code)
    && /\w+\[\w+\+1\]=\w+\[\w+\]/.test(code)
    && /while(?:\()?(\w+>=0|true).*?\w+\[\w+\]>\w+/.test(code)) {
    return "insertion-sort";
  }
  if (forLoopCount >= 2 && hasIndexedValues
    && /\w+\[\w+\]>\w+\[\w+\+1\]/.test(code)
    && /(?:swap\(|\[\w+\[\w+\],\w+\[\w+\+1\]\]=|=\w+\[\w+\+1\])/.test(code)) {
    return "bubble-sort";
  }
  if (forLoopCount >= 2 && hasIndexedValues
    && /(?:min|smallest)\w*=/.test(code) && /\w+\[\w+\]<\w+\[(?:min|smallest)\w*\]/.test(code)
    && /(?:swap\(|\[\w+\[\w+\],\w+\[(?:min|smallest)\w*\]\]=|\w+\[\w+\],\w+\[(?:min|smallest)\w*\]=|\w+\[\w+\]=\w+\[(?:min|smallest)\w*\];\w+\[(?:min|smallest)\w*\]=)/.test(code)) {
    return "selection-sort";
  }
  return null;
}

export function getDecisionInsight(step: Step, algorithm: AlgorithmId, target: number): string | null {
  if (step.kind === "compare" && algorithm === "binary-search") {
    const middle = step.pointers.mid;
    const value = step.values[middle];
    if (value === target) return `${value} at index ${middle} matches ${target}; the search is complete.`;
    if (value < target) return `${value} is below ${target}. Because the array is sorted, every value at or left of index ${middle} is too small, so search the right half.`;
    return `${value} is above ${target}. Because the array is sorted, every value at or right of index ${middle} is too large, so search the left half.`;
  }
  if (step.kind === "compare" && algorithm === "pair-sum") {
    const sum = step.values[step.highlighted[0]] + step.values[step.highlighted[1]];
    if (sum < target) return `${sum} is below ${target}. In a sorted array, moving the right pointer left could only make the sum smaller, so the left pointer is the one that can help.`;
    if (sum > target) return `${sum} is above ${target}. Moving the left pointer right could only make the sum larger, so move the right pointer left.`;
    return `${sum} matches the target. The search can stop here; the highlighted indices form the answer.`;
  }
  if (step.kind === "compare" && algorithm === "palindrome") {
    return step.values[step.highlighted[0]] === step.values[step.highlighted[1]]
      ? "A palindrome mirrors around its center. Matching outer values let us safely move inward."
      : "One mismatched mirrored pair is enough to disprove a palindrome; checking further pairs cannot change that result.";
  }
  if (step.kind === "compare" && algorithm === "bubble-sort") {
    return step.values[step.highlighted[0]] > step.values[step.highlighted[1]]
      ? "The left neighbor is larger, so swapping this adjacent pair moves the larger value toward the end."
      : "These neighbors are already ordered. Keeping them as-is preserves the sorted order for this pair.";
  }
  if (step.kind === "compare" && algorithm === "selection-sort") {
    return "Selection sort keeps the smallest value seen so far. Only after checking the remaining suffix can it place that minimum.";
  }
  if (step.kind === "compare" && algorithm === "insertion-sort") {
    return "The sorted prefix must stay ordered. Shift larger values right until the picked-up key has a valid position.";
  }
  if (step.kind === "move" && algorithm === "remove-duplicates") {
    return "The input is sorted, so equal neighbors are duplicates. Skipping this value keeps one copy without disturbing order.";
  }
  if (step.kind === "compare" && algorithm === "reverse") {
    return "Each outer pair belongs in the opposite position. After swapping, both pointers move inward so no index is revisited.";
  }
  return null;
}

export function parseArray(input: string): number[] {
  const tokens = input.split(/[,\s]+/).filter(Boolean);
  if (tokens.length > 16) throw new Error("Keep the array to 16 values or fewer for a clear trace.");
  const values = tokens.map((token) => {
    if (!/^-?\d+$/.test(token)) throw new Error(`“${token}” is not a whole number.`);
    const value = Number(token);
    if (!Number.isSafeInteger(value) || Math.abs(value) > 999) throw new Error("Values must be between -999 and 999.");
    return value;
  });
  if (!values.length) throw new Error("Enter at least one whole number.");
  return values;
}

export function findSyntaxErrorLine(source: string, language: Language): number | null {
  const stack: { token: string; line: number }[] = [];
  const matching: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  let quote = "";
  let escaped = false;
  let line = 1;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    const next = source[index + 1] ?? "";
    if (char === "\n") {
      line++;
      lineComment = false;
      continue;
    }
    if (lineComment) continue;
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index++;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === "/" && next === "/") {
      lineComment = true;
      index++;
      continue;
    }
    if (char === "/" && next === "*") {
      blockComment = true;
      index++;
      continue;
    }
    if (language === "python" && char === "#") {
      lineComment = true;
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      continue;
    }
    if (char === "(" || char === "[" || char === "{") {
      stack.push({ token: char, line });
    } else if (matching[char]) {
      const opening = stack.pop();
      if (!opening || opening.token !== matching[char]) return line;
    }
  }

  if (quote || blockComment) return line;
  return stack.at(-1)?.line ?? null;
}

export function mapTraceToSourceLines(trace: Step[], source: string, algorithm: AlgorithmId): Step[] {
  const lines = source.split("\n");
  const locate = (matches: (line: string) => boolean): number | null => {
    const index = lines.findIndex((line) => matches(line.trim()));
    return index < 0 ? null : index + 1;
  };
  const indexed = (line: string) => /\w+\s*\[[^\]]+\]/.test(line);
  const assignment = (line: string) => /(?:\+\+|--|\+=|-=|(?<![=!<>])=(?!=))/.test(line);

  return trace.map((step) => {
    let line: number | null = null;
    if (step.kind === "start") {
      line = locate((text) => Boolean(text) && !/^(?:#|\/\/|\/\*|\*|class\s|public:)/.test(text));
    } else if (step.kind === "compare") {
      line = locate((text) => {
        if (algorithm === "reverse") return /while\s*\(/.test(text);
        if (algorithm === "pair-sum") {
          return (/^\s*(?:if|elif)\b/i.test(text) && /(?:target|sum|total)/i.test(text))
            || (/^\s*(?:int|long|const|let|var)?\s*(?:sum|total)\s*=/.test(text) && /\+/.test(text));
        }
        if (algorithm === "binary-search") return indexed(text) && /(?:target|==|===|!=|!==|<|>)/.test(text);
        if (algorithm === "palindrome") return indexed(text) && /(?:==|!=)/.test(text);
        if (algorithm === "insertion-sort") return /while\s*\(/.test(text) && indexed(text);
        return indexed(text) && /(?:==|!=|<|>)/.test(text);
      });
    } else if (step.kind === "swap") {
      line = locate((text) => /swap\s*\(/.test(text) || (indexed(text) && assignment(text)));
    } else if (step.kind === "write") {
      line = locate((text) => indexed(text) && assignment(text));
    } else if (step.kind === "move") {
      line = locate((text) => algorithm === "binary-search"
        ? /(?:left|low|right|high)\s*=\s*\w+\s*[+-]\s*1/.test(text)
        : /(?:\+\+|--|\+=|-=)/.test(text) || (/^\w+\s*=/.test(text) && !indexed(text)));
    } else if (step.kind === "done") {
      line = locate((text) => /\breturn\b/.test(text));
    }

    return { ...step, line: line ?? Math.max(1, Math.min(step.line, lines.length)) };
  });
}

export function createTrace(algorithm: AlgorithmId, input: number[], target: number): Step[] {
  const values = [...input];
  const steps: Step[] = [{
    values: [...values], variables: { input: "ref @A1" }, heap: [{ address: "@A1", type: "number[]", values: [...values] }], pointers: {}, highlighted: [],
    line: 1, kind: "start", explanation: `Start with [${values.join(", ")}].`,
  }];
  const add = (line: number, kind: Step["kind"], explanation: string, highlighted: number[] = [], pointers: Record<string, number> = {}, locals: Record<string, number | string> = {}) => {
    steps.push({
      values: [...values],
      variables: { input: "ref @A1", ...pointers, ...locals, ...(algorithm === "pair-sum" || algorithm === "binary-search" ? { target } : {}) },
      heap: [{ address: "@A1", type: "number[]", values: [...values] }],
      pointers: { ...pointers },
      highlighted,
      line,
      kind,
      explanation,
    });
  };

  if (algorithm === "bubble-sort") {
    for (let end = values.length - 1; end > 0; end--) {
      for (let j = 0; j < end; j++) {
        add(4, "compare", `Compare ${values[j]} and ${values[j + 1]}.`, [j, j + 1], { i: values.length - 1 - end, j });
        if (values[j] > values[j + 1]) {
          const temp = values[j];
          add(5, "move", `Store ${temp} in a temporary while swapping.`, [j], { i: values.length - 1 - end, j }, { temp });
          [values[j], values[j + 1]] = [values[j + 1], values[j]];
          add(5, "swap", `${values[j]} and ${values[j + 1]} trade places.`, [j, j + 1], { i: values.length - 1 - end, j });
        }
      }
      add(3, "move", `${values[end]} is now in its final position.`, [end], { sorted: end });
    }
  } else if (algorithm === "selection-sort") {
    for (let i = 0; i < values.length; i++) {
      let min = i;
      for (let j = i + 1; j < values.length; j++) {
        add(5, "compare", `Compare ${values[j]} with the current minimum ${values[min]}.`, [j, min], { i, min, j });
        if (values[j] < values[min]) {
          min = j;
          add(5, "move", `${values[min]} is the new minimum.`, [min], { i, min });
        }
      }
      if (min !== i) {
        const temp = values[i];
        add(7, "move", `Store ${temp} in a temporary while swapping.`, [i], { i, min }, { temp });
        [values[i], values[min]] = [values[min], values[i]];
        add(7, "swap", `Place ${values[i]} at position ${i}.`, [i, min], { i, min });
      } else add(7, "move", `${values[i]} is already the smallest remaining value.`, [i], { i });
    }
  } else if (algorithm === "insertion-sort") {
    for (let i = 1; i < values.length; i++) {
      const key = values[i];
      let j = i - 1;
      add(2, "move", `Pick up ${key}; the left side is sorted.`, [i], { i });
      while (j >= 0) {
        add(5, "compare", `Compare ${values[j]} with ${key}.`, [j, j + 1], { i, j });
        if (values[j] <= key) break;
        values[j + 1] = values[j];
        add(6, "write", `Shift ${values[j]} one place to the right.`, [j, j + 1], { i, j });
        j--;
      }
      values[j + 1] = key;
      add(8, "write", `Insert ${key} at position ${j + 1}.`, [j + 1], { i, j: j + 1 });
    }
  } else if (algorithm === "reverse") {
    let left = 0;
    let right = values.length - 1;
    while (left < right) {
      add(3, "compare", `The pointers meet values ${values[left]} and ${values[right]}.`, [left, right], { left, right });
      const temp = values[left];
      add(4, "move", `Store ${temp} in a temporary while swapping.`, [left], { left, right }, { temp });
      [values[left], values[right]] = [values[right], values[left]];
      add(4, "swap", `Swap the values at the left and right pointers.`, [left, right], { left, right });
      left++;
      right--;
      add(5, "move", "Move both pointers one step toward the center.", [left, right].filter((i) => i >= 0 && i < values.length), { left, right });
    }
  } else if (algorithm === "binary-search") {
    if (values.some((value, index) => index > 0 && value < values[index - 1])) {
      throw new Error("Binary search needs a sorted array. Sort the values first.");
    }
    let left = 0;
    let right = values.length - 1;
    let found = false;
    while (left <= right) {
      const mid = left + Math.floor((right - left) / 2);
      add(4, "compare", `Check the middle value ${values[mid]} at index ${mid} against target ${target}.`, [mid], { left, right, mid }, { value: values[mid] });
      if (values[mid] === target) {
        found = true;
        add(5, "done", `Found ${target} at index ${mid}.`, [mid], { left, right, mid }, { result: mid });
        break;
      }
      if (values[mid] < target) {
        left = mid + 1;
        add(7, "move", `${values[mid]} is too small. Discard indices ${0} through ${mid} and search the right half.`, [left, right].filter((index) => index >= 0 && index < values.length), { left, right }, { mid });
      } else {
        right = mid - 1;
        add(9, "move", `${values[mid]} is too large. Discard indices ${mid} through the end and search the left half.`, [left, right].filter((index) => index >= 0 && index < values.length), { left, right }, { mid });
      }
    }
    if (!found) add(11, "done", `${target} is not in the array; the search range is empty.`, [], { left, right }, { result: -1 });
  } else if (algorithm === "pair-sum") {
    if (values.some((value, index) => index > 0 && value < values[index - 1])) throw new Error("Pair sum needs a sorted array. Sort the values first.");
    let left = 0;
    let right = values.length - 1;
    while (left < right) {
      const sum = values[left] + values[right];
      add(4, "compare", `${values[left]} + ${values[right]} = ${sum}; target is ${target}.`, [left, right], { left, right }, { sum });
      if (sum === target) {
        add(5, "done", `Found the target using indices ${left} and ${right}.`, [left, right], { left, right });
        break;
      }
      if (sum < target) {
        left++;
        add(6, "move", "The sum is too small, so move the left pointer right.", [left, right], { left, right });
      } else {
        right--;
        add(6, "move", "The sum is too large, so move the right pointer left.", [left, right], { left, right });
      }
    }
    if (steps[steps.length - 1].kind !== "done") add(8, "done", `No pair adds up to ${target}.`, []);
  } else if (algorithm === "palindrome") {
    let left = 0;
    let right = values.length - 1;
    let matched = true;
    while (left < right) {
      add(4, "compare", `Compare ${values[left]} at the left with ${values[right]} at the right.`, [left, right], { left, right });
      if (values[left] !== values[right]) {
        matched = false;
        add(5, "done", "The values differ, so this array is not a palindrome.", [left, right], { left, right });
        break;
      }
      left++;
      right--;
      add(6, "move", "They match; move both pointers toward the center.", [left, right].filter((i) => i >= 0 && i < values.length), { left, right });
    }
    if (matched) add(8, "done", "Every mirrored pair matches: this array is a palindrome.", []);
  } else {
    if (values.some((value, index) => index > 0 && value < values[index - 1])) throw new Error("Remove duplicates expects a sorted array.");
    let slow = 0;
    for (let fast = 1; fast < values.length; fast++) {
      add(5, "compare", `Compare ${values[fast]} with the last unique value ${values[slow]}.`, [slow, fast], { slow, fast });
      if (values[fast] !== values[slow]) {
        slow++;
        values[slow] = values[fast];
        add(7, "write", `Keep ${values[fast]} at the next unique position.`, [slow], { slow, fast });
      } else add(5, "move", `Skip the duplicate ${values[fast]}.`, [fast], { slow, fast });
    }
    values.length = slow + 1;
    add(9, "done", `The unique values are [${values.join(", ")}].`, values.map((_, i) => i), { slow });
  }

  if (steps[steps.length - 1].kind !== "done") {
    add(1, "done", `Finished: [${values.join(", ")}].`, values.map((_, i) => i));
  }
  return steps;
}
