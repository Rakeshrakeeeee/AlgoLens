export type SnapshotValue = null | boolean | number | string | { $ref: string } | { type: string; summary: string };

export type HeapNode = {
  id: string;
  type: string;
  kind: "sequence" | "mapping";
  items?: SnapshotValue[];
  entries?: [SnapshotValue, SnapshotValue][];
  truncated?: boolean;
};

export type RuntimeEvent = {
  sequence: number;
  kind: "call" | "line" | "return" | "exception";
  line: number;
  function: string;
  frameId: number;
  parentFrameId: number | null;
  locals: Record<string, SnapshotValue>;
  heap: HeapNode[];
};

type Collection = {
  values: unknown[];
  truncated: boolean;
};

const MAX_EXPLANATION_CHANGES = 3;
const MAX_RENDERED_LENGTH = 120;

function findHeapNode(value: SnapshotValue, heap: HeapNode[]): HeapNode | undefined {
  return value !== null && typeof value === "object" && "$ref" in value
    ? heap.find((node) => node.id === value.$ref)
    : undefined;
}

function readCollection(value: SnapshotValue | undefined, heap: HeapNode[]): Collection | undefined {
  if (typeof value === "string") return { values: [...value], truncated: false };
  const node = value === undefined ? undefined : findHeapNode(value, heap);
  if (!node || node.kind !== "sequence") return undefined;
  return { values: node.items ?? [], truncated: node.truncated ?? false };
}

function plainValue(value: SnapshotValue | undefined, heap: HeapNode[], depth = 0, seen = new Set<string>()): unknown {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== "object") return value;
  if (!("$ref" in value)) return value.summary;
  if (depth >= 2 || seen.has(value.$ref)) return "[nested value]";
  const node = heap.find((candidate) => candidate.id === value.$ref);
  if (!node) return "[unavailable value]";
  seen.add(value.$ref);
  let result: unknown;
  if (node.kind === "sequence") {
    const items = node.items ?? [];
    result = items.slice(0, 8).map((item) => plainValue(item, heap, depth + 1, seen));
    if (node.truncated || items.length > 8) (result as unknown[]).push("…");
  } else {
    const entries = node.entries ?? [];
    result = entries.slice(0, 8).map(([key, item]) => [
      plainValue(key, heap, depth + 1, seen),
      plainValue(item, heap, depth + 1, seen),
    ]);
    if (node.truncated || entries.length > 8) (result as unknown[][]).push(["…", "…"]);
  }
  seen.delete(value.$ref);
  return result;
}

function displayValue(value: unknown): string {
  const text = typeof value === "string" ? JSON.stringify(value) : JSON.stringify(value);
  if (text === undefined) return "unavailable";
  return text.length > MAX_RENDERED_LENGTH ? `${text.slice(0, MAX_RENDERED_LENGTH - 1)}…` : text;
}

function snapshotEquals(left: SnapshotValue | undefined, leftHeap: HeapNode[], right: SnapshotValue | undefined, rightHeap: HeapNode[]): boolean {
  return JSON.stringify(plainValue(left, leftHeap)) === JSON.stringify(plainValue(right, rightHeap));
}

function compare(operator: string, left: number, right: number): boolean {
  switch (operator) {
    case "<": return left < right;
    case "<=": return left <= right;
    case ">": return left > right;
    case ">=": return left >= right;
    case "==": return left === right;
    case "!=": return left !== right;
    default: return false;
  }
}

function explainSkippedPythonLoop(source: string, previous: RuntimeEvent, current: RuntimeEvent): string | undefined {
  if (previous.kind !== "line" || current.kind !== "line" || previous.frameId !== current.frameId) return undefined;
  const lines = source.split(/\r?\n/);
  const header = lines[previous.line - 1];
  const nextLine = lines[current.line - 1];
  if (!header || !nextLine || current.line <= previous.line) return undefined;
  const match = /^(\s*)for\s+[A-Za-z_]\w*\s+in\s+([A-Za-z_]\w*)\s*:\s*(?:#.*)?$/.exec(header);
  if (!match) return undefined;
  const nextIndent = /^(\s*)/.exec(nextLine)?.[1].length ?? 0;
  if (nextIndent > match[1].length) return undefined;
  const iterable = readCollection(previous.locals[match[2]], previous.heap);
  if (!iterable || iterable.values.length !== 0 || iterable.truncated) return undefined;
  return `The loop body was skipped because ${match[2]} is empty.`;
}

function explainSkippedJavaLoop(source: string, previous: RuntimeEvent, current: RuntimeEvent): string | undefined {
  if (previous.kind !== "line" || current.kind !== "line" || previous.frameId !== current.frameId) return undefined;
  if (previous.line >= current.line) return undefined;
  const lines = source.split(/\r?\n/);
  const loopPattern = /^\s*for\s*\(\s*(?:(?:int|long|short|byte)\s+)?([A-Za-z_$][\w$]*)\s*=\s*(-?\d+)\s*;\s*\1\s*(<|<=|>|>=|==|!=)\s*(?:([A-Za-z_$][\w$]*)\.length|(-?\d+))\s*;\s*(?:\1\s*\+\+|\+\+\s*\1|\1\s*=\s*\1\s*\+\s*1)\s*\)\s*\{\s*(?:\/\/.*)?$/;
  const candidateLines = [
    lines[previous.line - 1],
    ...lines.slice(previous.line, current.line - 1),
  ];
  const match = candidateLines.map((line) => line && loopPattern.exec(line)).find(Boolean);
  if (!match) return undefined;
  const start = Number(match[2]);
  let bound: number;
  let boundDescription: string;
  if (match[3] && match[4]) {
    const collection = readCollection(previous.locals[match[4]], previous.heap);
    if (!collection || collection.truncated) return undefined;
    bound = collection.values.length;
    boundDescription = `${match[4]}.length (${bound})`;
  } else if (match[5] !== undefined) {
    bound = Number(match[5]);
    boundDescription = match[5];
  } else {
    return undefined;
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(bound) || compare(match[3], start, bound)) return undefined;
  return `The loop body was skipped: ${match[1]} starts at ${start}, and the condition ${match[1]} ${match[3]} ${boundDescription} is false.`;
}

function explainChanges(previous: RuntimeEvent, current: RuntimeEvent): string {
  const names = new Set([...Object.keys(previous.locals), ...Object.keys(current.locals)]);
  const changes: string[] = [];
  for (const name of names) {
    const before = previous.locals[name];
    const after = current.locals[name];
    if (snapshotEquals(before, previous.heap, after, current.heap)) continue;
    const beforeValue = displayValue(plainValue(before, previous.heap));
    const afterValue = displayValue(plainValue(after, current.heap));
    changes.push(`${name} changed from ${beforeValue} to ${afterValue}`);
    if (changes.length === MAX_EXPLANATION_CHANGES) break;
  }
  if (changes.length) return `Captured state changed: ${changes.join("; ")}.`;
  return "No supported local-value change was detected between these runtime events.";
}

export function describeRuntimeStep(source: string, current?: RuntimeEvent, previous?: RuntimeEvent): string {
  if (!current) return "Run a supported method to see its runtime steps here.";
  if (!previous) {
    if (current.kind === "call") return `Execution entered ${current.function}().`;
    if (current.kind === "return") return `Execution returned from ${current.function}() at line ${current.line}.`;
    if (current.kind === "exception") return `Execution stopped with an exception in ${current.function}() at line ${current.line}. See the error message for details.`;
    return `Execution reached line ${current.line} in ${current.function}(). There is no earlier event to compare.`;
  }
  if (current.kind === "exception") {
    return `Execution stopped with an exception in ${current.function}() at line ${current.line}. See the error message for details.`;
  }
  if (current.kind === "return") return `Execution returned from ${current.function}() at line ${current.line}.`;
  if (previous.frameId !== current.frameId) {
    return `Execution moved to ${current.function}() at line ${current.line}. The previous event was in a different call frame.`;
  }
  const skippedLoop = explainSkippedPythonLoop(source, previous, current)
    ?? explainSkippedJavaLoop(source, previous, current);
  if (skippedLoop) return skippedLoop;
  if (current.kind !== "line") return `Execution recorded a ${current.kind} event in ${current.function}().`;
  return `Execution reached line ${current.line} in ${current.function}(). ${explainChanges(previous, current)}`;
}
