import { useEffect, useMemo, useState } from "react";
import {
  describeRuntimeStep,
  type HeapNode,
  type RuntimeEvent,
  type SnapshotValue,
} from "./execution-explanations";
type ExecutionLanguage = "python" | "java";
type RunnerResponse = {
  status: string;
  events?: RuntimeEvent[];
  result?: { value: SnapshotValue; heap: HeapNode[] };
  error?: { type?: string; message?: string; line?: number | null };
  stdout?: string;
  outputTruncated?: boolean;
  truncated?: boolean;
  diagnostics?: { line: number | null; message: string }[];
};

type ExecutionOutcome = "matches" | "mismatch" | "invalid-expected" | null;

const initialCode = `class Solution:
    def maxSubArray(self, nums):
        current = best = nums[0]
        for value in nums[1:]:
            current = max(value, current + value)
            best = max(best, current)
        return best`;

const initialJavaCode = `class Solution {
    public int maxSubArray(int[] nums) {
        int current = nums[0];
        int best = nums[0];
        for (int i = 1; i < nums.length; i++) {
            current = Math.max(nums[i], current + nums[i]);
            best = Math.max(best, current);
        }
        return best;
    }
}`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSnapshotValue(value: unknown): value is SnapshotValue {
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) return true;
  if (!isRecord(value)) return false;
  return typeof value.$ref === "string"
    || (typeof value.type === "string" && typeof value.summary === "string");
}

function isRuntimeEvent(value: unknown): value is RuntimeEvent {
  if (!isRecord(value) || !["call", "line", "return", "exception"].includes(String(value.kind))) return false;
  if (typeof value.sequence !== "number" || typeof value.line !== "number" || typeof value.function !== "string") return false;
  if (typeof value.frameId !== "number" || !(value.parentFrameId === null || typeof value.parentFrameId === "number")) return false;
  if (!isRecord(value.locals) || !Array.isArray(value.heap)) return false;
  return Object.values(value.locals).every(isSnapshotValue)
    && value.heap.every((node) => isRecord(node)
      && typeof node.id === "string"
      && typeof node.type === "string"
      && ["sequence", "mapping"].includes(String(node.kind)));
}

function isRunnerResponse(value: unknown): value is RunnerResponse {
  if (!isRecord(value) || typeof value.status !== "string") return false;
  if (value.events !== undefined && (!Array.isArray(value.events) || !value.events.every(isRuntimeEvent))) return false;
  return true;
}

function formatValue(value: SnapshotValue): string {
  if (value === null) return "None";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "object") return "$ref" in value ? `ref ${value.$ref}` : `<${value.type}>`;
  return String(value);
}

function formatResult(value: SnapshotValue, heap: HeapNode[]): string {
  const decoded = decodeHeapValue(value, heap);
  return JSON.stringify(decoded) ?? formatValue(value);
}

function decodeHeapValue(value: SnapshotValue, heap: HeapNode[], seen = new Set<string>()): unknown {
  if (value === null || typeof value !== "object" || !("$ref" in value)) return value;
  if (seen.has(value.$ref)) return `<cycle ${value.$ref}>`;
  const node = heap.find((candidate) => candidate.id === value.$ref);
  if (!node) return `<missing ${value.$ref}>`;
  seen.add(value.$ref);
  let decoded: unknown;
  if (node.kind === "sequence") {
    decoded = (node.items ?? []).map((item) => decodeHeapValue(item, heap, seen));
  } else {
    decoded = Object.fromEntries((node.entries ?? []).map(([key, item]) => [
      String(decodeHeapValue(key, heap, seen)),
      decodeHeapValue(item, heap, seen),
    ]));
  }
  seen.delete(value.$ref);
  return decoded;
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => valuesEqual(value, right[index]));
  }
  if (isRecord(left) && isRecord(right)) {
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return leftKeys.length === rightKeys.length
      && leftKeys.every((key, index) => key === rightKeys[index] && valuesEqual(left[key], right[key]));
  }
  return false;
}

function nodeItemLabel(value: SnapshotValue, index: number): string {
  return `${index}: ${formatValue(value)}`;
}

type MethodCandidate = {
  name: string;
  parameters: { name: string; type: string }[];
};

function splitParameters(parameters: string): string[] {
  const parts: string[] = [];
  let genericDepth = 0;
  let start = 0;
  for (let index = 0; index < parameters.length; index++) {
    if (parameters[index] === "<") genericDepth++;
    if (parameters[index] === ">") genericDepth--;
    if (parameters[index] === "," && genericDepth === 0) {
      parts.push(parameters.slice(start, index).trim());
      start = index + 1;
    }
  }
  if (parameters.slice(start).trim()) parts.push(parameters.slice(start).trim());
  return parts;
}

function discoverMethods(source: string, language: ExecutionLanguage): MethodCandidate[] {
  const candidates: MethodCandidate[] = [];
  if (language === "java") {
    const pattern = /\b(?:public|protected)\s+(?:static\s+)?[\w.$<>?,\[\]\s]+?\s+([A-Za-z_$][\w$]*)\s*\(([^()]*)\)/g;
    for (const match of source.matchAll(pattern)) {
      candidates.push({
        name: match[1],
        parameters: splitParameters(match[2]).map((parameter, index) => {
          const tokens = parameter.replace(/\bfinal\s+/g, "").trim().split(/\s+/);
          return { type: tokens.slice(0, -1).join(" ") || "Object", name: tokens.at(-1) || `arg${index}` };
        }),
      });
    }
  } else {
    const pattern = /^\s*def\s+([A-Za-z_]\w*)\s*\(([^()]*)\)/gm;
    for (const match of source.matchAll(pattern)) {
      if (match[1] === "__init__") continue;
      candidates.push({
        name: match[1],
        parameters: splitParameters(match[2])
          .filter((parameter) => parameter !== "self" && parameter !== "cls")
          .map((parameter, index) => {
            const [name, type = ""] = parameter.split(":").map((part) => part.trim());
            return { name: (name || `arg${index}`).split("=")[0].trim(), type };
          }),
      });
    }
  }
  return candidates;
}

function defaultArgument(parameter: MethodCandidate["parameters"][number], language: ExecutionLanguage): unknown {
  const type = parameter.type.toLowerCase();
  const name = parameter.name.toLowerCase();
  if (type.includes("[]") || type.includes("list") || type.includes("array") || /^(nums|arr|array|values)$/.test(name)) return [1, 2, 3];
  if (type.includes("map") || type.includes("dict")) return {};
  if (type.includes("boolean") || type === "bool") return false;
  if (type.includes("string") || /^(s|text|word)$/.test(name)) return "";
  if (type.includes("char")) return "a";
  if (type && !/^(int|long|short|byte|double|float|bool|boolean)$/.test(type)) return null;
  return language === "python" && !type ? null : 0;
}

export function ExecutionPanel() {
  const [language, setLanguage] = useState<ExecutionLanguage>("python");
  const [source, setSource] = useState(initialCode);
  const [method, setMethod] = useState("maxSubArray");
  const [argumentsText, setArgumentsText] = useState("[[-2, 1, -3, 4, -1, 2, 1, -5, 4]]");
  const [expectedText, setExpectedText] = useState("6");
  const [events, setEvents] = useState<RuntimeEvent[]>([]);
  const [response, setResponse] = useState<RunnerResponse | null>(null);
  const [outcome, setOutcome] = useState<ExecutionOutcome>(null);
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [runnerAvailable, setRunnerAvailable] = useState<boolean | null>(null);
  const methodCandidates = useMemo(() => discoverMethods(source, language), [source, language]);

  const current = events[position];
  const previous = events[position - 1];
  const sourceLines = source.split("\n");
  const progress = useMemo(
    () => events.length > 1 ? (position / (events.length - 1)) * 100 : 0,
    [events.length, position],
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health")
      .then((result) => {
        if (!result.ok) throw new Error("Local runner is not available.");
        return result.json() as Promise<unknown>;
      })
      .then((health) => {
        if (!cancelled) setRunnerAvailable(isRecord(health) && health.status === "ok");
      })
      .catch(() => {
        if (!cancelled) setRunnerAvailable(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!playing || events.length === 0) return;
    const timer = window.setInterval(() => {
      setPosition((currentPosition) => {
        if (currentPosition >= events.length - 1) {
          setPlaying(false);
          return currentPosition;
        }
        return currentPosition + 1;
      });
    }, 900);
    return () => window.clearInterval(timer);
  }, [playing, events]);

  useEffect(() => {
    if (position === events.length - 1) setPlaying(false);
  }, [events.length, position]);

  useEffect(() => {
    if (!methodCandidates.length || methodCandidates.some((candidate) => candidate.name === method)) return;
    const candidate = methodCandidates[0];
    setMethod(candidate.name);
    setArgumentsText(JSON.stringify(candidate.parameters.map((parameter) => defaultArgument(parameter, language))));
    setExpectedText("");
    clearTrace();
  }, [language, method, methodCandidates]);

  async function runCode() {
    setBusy(true);
    setPlaying(false);
    setMessage("");
    setEvents([]);
    setPosition(0);
    setResponse(null);
    setOutcome(null);
    setOutcome(null);
    let parsedArguments: unknown;
    try {
      parsedArguments = JSON.parse(argumentsText);
    } catch {
      setMessage("Arguments must be valid JSON.");
      setBusy(false);
      return;
    }
    if (!Array.isArray(parsedArguments)) {
      setMessage("Enter method arguments as a JSON array, for example [[1, 2, 3]].");
      setBusy(false);
      return;
    }
    const requestSize = new TextEncoder().encode(JSON.stringify({ source, method, arguments: parsedArguments })).byteLength;
    if (requestSize > 32 * 1024) {
      setMessage("Keep the source and JSON arguments under 32 KB combined.");
      setBusy(false);
      return;
    }
    try {
      const result = await fetch("/api/trace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, source, method, arguments: parsedArguments }),
      });
      const body: unknown = await result.json();
      if (!isRunnerResponse(body)) throw new Error("The local runner returned an invalid trace.");
      if (!result.ok) {
        throw new Error(body.error?.message ?? "The local runner could not start.");
      }
      setResponse(body);
      setEvents(body.events ?? []);
      setRunnerAvailable(body.status !== "runner_unavailable");
      if (body.status === "ok" && body.result && expectedText.trim()) {
        try {
          const expected = JSON.parse(expectedText) as unknown;
          const actual = decodeHeapValue(body.result.value, body.result.heap);
          setOutcome(valuesEqual(actual, expected) ? "matches" : "mismatch");
        } catch {
          setOutcome("invalid-expected");
        }
      } else if (!expectedText.trim()) {
        setOutcome(null);
      }
      if (body.status === "invalid_request") {
        setMessage(body.error?.message ?? "Check the source, method, and JSON input.");
      } else if (body.status === "runner_unavailable") {
        setRunnerAvailable(false);
        setMessage(body.error?.message ?? "Start Docker Desktop and the local runner, then retry.");
      } else if (body.status === "runner_busy") {
        setMessage(body.error?.message ?? "A trace is already running.");
      } else if (body.status === "error") {
        const diagnostic = body.diagnostics?.[0];
        const line = diagnostic?.line ?? body.error?.line;
        setMessage(`${body.error?.type ?? "Execution error"}${line ? ` on line ${line}` : ""}: ${diagnostic?.message ?? body.error?.message ?? "The program stopped."}`);
      } else if (body.status === "runner_error") {
        setMessage(body.error?.message ?? "The sandbox could not return a trace.");
      } else if (body.status === "ok" && body.truncated) {
        setMessage("Trace limit reached. This trace is incomplete; increase or simplify the input to inspect the rest.");
      }
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not reach the local execution service.");
      setRunnerAvailable(false);
    } finally {
      setBusy(false);
    }
  }

  function clearTrace() {
    setPlaying(false);
    setEvents([]);
    setResponse(null);
    setPosition(0);
    setMessage("");
  }

  function variableChanged(name: string, value: SnapshotValue): boolean {
    return previous !== undefined && JSON.stringify(previous.locals[name]) !== JSON.stringify(value);
  }

  function renderValue(value: SnapshotValue) {
    if (value !== null && typeof value === "object" && "$ref" in value) {
      return <span className="runtime-ref">{value.$ref}</span>;
    }
    return formatValue(value);
  }

  return (
    <section className="execution-workspace" aria-label={`${language === "python" ? "Python" : "Java"} execution visualizer`}>
      <div className="execution-intro">
        <div><span className="execution-eyebrow">LOCAL EXECUTION · PYTHON + JAVA BETA</span><h2>Step through your own solution.</h2><p>Runs in an isolated Docker container on this computer. No code is uploaded.</p></div>
        <span className={`runner-status ${runnerAvailable ? "runner-ready" : ""}`}><i />{runnerAvailable === null ? "CHECKING RUNNER" : runnerAvailable ? "RUNNER READY" : "RUNNER OFFLINE"}</span>
      </div>
      <div className="execution-grid">
        <section className="panel execution-code-panel">
          <div className="execution-input-row">
            <label className="execution-language-select"><span>LANGUAGE</span><select aria-label="Execution language" value={language} onChange={(event) => {
              const next: ExecutionLanguage = event.target.value === "java" ? "java" : "python";
              setLanguage(next);
              setSource(next === "python" ? initialCode : initialJavaCode);
              setMethod("maxSubArray");
              setArgumentsText("[[-2, 1, -3, 4, -1, 2, 1, -5, 4]]");
              setExpectedText("6");
              clearTrace();
            }}><option value="python">Python 3.13</option><option value="java">Java 21</option></select></label>
            <label><span>METHOD TO VISUALIZE</span>{methodCandidates.length ? <select aria-label="Method to visualize" value={method} onChange={(event) => {
              const candidate = methodCandidates.find((item) => item.name === event.target.value);
              setMethod(event.target.value);
              if (candidate) {
                let currentArguments: unknown;
                try { currentArguments = JSON.parse(argumentsText); } catch { currentArguments = null; }
                if (!Array.isArray(currentArguments) || currentArguments.length !== candidate.parameters.length) {
                  setArgumentsText(JSON.stringify(candidate.parameters.map((parameter) => defaultArgument(parameter, language))));
                }
              }
              setExpectedText("");
              clearTrace();
            }}>{methodCandidates.map((candidate, index) => <option key={`${candidate.name}-${index}`} value={candidate.name}>{candidate.name}({candidate.parameters.map((parameter) => parameter.name).join(", ")})</option>)}</select> : <input aria-label="Method to visualize" value={method} maxLength={80} onChange={(event) => { setMethod(event.target.value); clearTrace(); }} />}</label>
          </div>
          <div className="editor execution-editor">
            <div className="editor-top"><span className="file-dot" /><span>solution.py</span><span className="editor-readonly">RUNTIME TRACE</span></div>
            <div className="code-area">
              <div className="line-numbers" aria-hidden="true">{sourceLines.map((_, index) => <span className={`${current?.line === index + 1 ? "active-line-number" : ""} ${response?.error?.line === index + 1 ? "error-line-number" : ""}`} key={index}>{String(index + 1).padStart(2, "0")}</span>)}</div>
              <textarea
                spellCheck={false}
                aria-label={`${language === "python" ? "Python" : "Java"} solution source code`}
                value={source}
                maxLength={12_000}
                onChange={(event) => { setSource(event.target.value); clearTrace(); }}
              />
              {(current || response?.error?.line) && <div className={`line-highlight ${response?.error?.line ? "line-highlight-error" : ""}`} aria-hidden="true" style={{ top: `${(Math.max(1, response?.error?.line ?? current?.line ?? 1) - 1) * 22 + 7}px` }} />}
            </div>
            <div className="editor-foot"><span className="editor-foot-dot" /> {language === "python" ? "Python 3.13" : "Java 21"} · isolated local container <span className="editor-foot-right">No host files mounted</span></div>
          </div>
          <label className="execution-arguments"><span>METHOD ARGUMENTS · JSON ARRAY</span><textarea aria-label="Method arguments as JSON array" value={argumentsText} onChange={(event) => { setArgumentsText(event.target.value); clearTrace(); }} rows={3} spellCheck={false} /></label>
          <p className="execution-hint">Paste a LeetCode <code>class Solution</code> or a top-level function. Choose the method to trace; you do not need to write a <code>main</code> method. Arguments are passed in order as JSON, e.g. <code>[[1, 2, 3], 5]</code>.</p>
          <label className="execution-expected"><span>EXPECTED RESULT · OPTIONAL JSON</span><input aria-label="Expected result JSON" value={expectedText} onChange={(event) => { setExpectedText(event.target.value); setOutcome(null); }} spellCheck={false} /></label>
          {message && <div className={`execution-message ${response?.status === "error" ? "execution-error" : ""}`} role="alert">{message}</div>}
          <button className="run-button" onClick={runCode} disabled={busy || source.length > 12_000}>
            <span>{busy ? "…" : "▶"}</span>{busy ? " Running in local sandbox…" : " Run and visualize"}<span className="run-arrow">↗</span>
          </button>
          <p className="sandbox-note">Limits: Python 10s / Java 8s · 256 MB RAM · no network · temporary container</p>
        </section>

        <section className="panel execution-trace-panel">
          <div className="execution-trace-heading"><div><h3>Runtime snapshot</h3><p>{current ? `${current.function} · line ${current.line}` : "Run a solution to inspect its execution."}</p></div><span>{events.length ? `${String(position + 1).padStart(2, "0")} / ${events.length}` : "WAITING"}</span></div>
          <div className="runtime-explanation" role="status" aria-live="polite">
            <span className="memory-section-label">STEP EXPLANATION</span>
            <p>{describeRuntimeStep(source, current, previous)}</p>
          </div>
          <div className="runtime-callstack"><span className="memory-section-label">ACTIVE FRAME</span>{current ? <code>{current.function}() · frame #{current.frameId}</code> : <small>Call stack appears here when a trace is ready.</small>}</div>
          <div className="runtime-memory">
            <span className="memory-section-label">LOCAL VARIABLES</span>
            {current && Object.keys(current.locals).length > 0 ? Object.entries(current.locals).map(([name, value]) => (
              <div className={`variable-row ${variableChanged(name, value) ? "variable-changed" : ""}`} key={name}><span>{name}</span><code>{renderValue(value)}</code>{variableChanged(name, value) && <i>changed</i>}</div>
            )) : <small className="runtime-empty">No local variables in this frame.</small>}
            {current && (() => {
              const sequence = Object.entries(current.locals).map(([name, value]) => {
                if (value !== null && typeof value === "object" && "$ref" in value) {
                  const object = current.heap.find((node) => node.id === value.$ref && node.kind === "sequence");
                  if (object) return { name, values: object.items ?? [], object, truncated: object.truncated ?? false };
                }
                if (typeof value === "string" && value.length > 0) {
                  return { name, values: [...value].slice(0, 64), object: undefined, truncated: value.length > 64 };
                }
                return null;
              }).find((item) => item !== null);
              if (!sequence?.values.length) return null;
              const previousObject = sequence.object && previous?.heap.find((node) => node.id === sequence.object?.id);
              const previousString = previous?.locals[sequence.name];
              return (
                <div className="runtime-array-visual" aria-label={`${sequence.name} live values`}>
                  <span className="memory-section-label">LIVE {sequence.object ? "ARRAY" : "STRING"} · {sequence.name}</span>
                  <div className="runtime-array-cells">
                    {sequence.values.slice(0, 32).map((value, index) => {
                      const previousValue = sequence.object
                        ? previousObject?.items?.[index]
                        : typeof previousString === "string" ? [...previousString][index] : undefined;
                      const changed = previousValue !== undefined && JSON.stringify(previousValue) !== JSON.stringify(value);
                      const numeric = typeof value === "number" ? value : 0;
                      const height = Math.max(9, Math.min(52, 12 + Math.abs(numeric) * 2));
                      return <div className={`runtime-array-cell ${changed ? "runtime-array-cell-changed" : ""}`} key={`${index}-${String(value)}`}><span className="runtime-array-bar" style={{ height: `${height}px` }}>{formatValue(value)}</span><small>{index}</small></div>;
                    })}
                    {(sequence.truncated || sequence.values.length > 32) && <span className="runtime-array-clipped">…more</span>}
                  </div>
                </div>
              );
            })()}
            <span className="memory-section-label runtime-heap-label">REACHABLE OBJECTS</span>
            {current?.heap.length ? current.heap.map((node) => (
              <div className="runtime-heap-object" key={node.id}>
                <div className="heap-object-title"><span>{node.id}</span><small>{node.type}{node.truncated ? " · clipped" : ""}</small></div>
                {node.kind === "sequence" && <div className="runtime-heap-items">{(node.items ?? []).map((item, index) => <span key={index}>{nodeItemLabel(item, index)}</span>)}</div>}
                {node.kind === "mapping" && <div className="runtime-heap-items">{(node.entries ?? []).map(([key, item], index) => <span key={index}>{formatValue(key)}: {formatValue(item)}</span>)}</div>}
              </div>
            )) : <small className="runtime-empty">No reachable collection objects at this step.</small>}
          </div>
          {response?.status === "ok" && response.result && <div className="runtime-result"><span>RETURN VALUE</span><code>{formatResult(response.result.value, response.result.heap)}</code></div>}
          {outcome && <p className={`expected-result ${outcome === "matches" ? "expected-result-match" : outcome === "mismatch" ? "expected-result-mismatch" : ""}`} role="status">{outcome === "matches" ? "✓ Returned result matches the expected value." : outcome === "mismatch" ? "✕ Returned result differs from the expected value. Step through this input to inspect the code path." : "Execution worked, but the expected result is not valid JSON."}</p>}
          {response?.stdout && <pre className="runtime-output">{response.stdout}{response.outputTruncated ? "\n[output truncated]" : ""}</pre>}
          {response?.truncated && <p className="trace-truncated">Trace was capped; later execution states are not shown.</p>}
          <div className="playback execution-playback">
            <div className="playback-buttons">
              <button className="control-button" onClick={() => { setPosition(0); setPlaying(false); }} disabled={!events.length} aria-label="Reset"><span>↺</span></button>
              <button className="control-button" onClick={() => setPosition((value) => Math.max(0, value - 1))} disabled={!events.length || position === 0} aria-label="Previous step"><span>‹</span></button>
              <button className="play-button" onClick={() => { if (position >= events.length - 1) setPosition(0); setPlaying(!playing); }} disabled={!events.length} aria-label={playing ? "Pause" : "Play"}><span>{playing ? "Ⅱ" : "▶"}</span></button>
              <button className="control-button" onClick={() => setPosition((value) => Math.min(events.length - 1, value + 1))} disabled={!events.length || position >= events.length - 1} aria-label="Next step"><span>›</span></button>
            </div>
            <span className="execution-event-kind">{current?.kind.toUpperCase() ?? "NO EVENT"}</span>
          </div>
          <div className="scrubber-wrap"><input aria-label="Runtime trace position" type="range" min="0" max={Math.max(0, events.length - 1)} value={events.length ? position : 0} onChange={(event) => setPosition(Number(event.target.value))} style={{ "--range-progress": `${progress}%` } as React.CSSProperties} disabled={!events.length} /><div><span>START</span><span>{events.length ? `${events.length} EVENTS` : "NO TRACE YET"}</span></div></div>
        </section>
      </div>
      <section className="panel runtime-log">
        <div className="log-heading"><div><div className="panel-title"><span className="panel-icon log-icon">≡</span><div><h2>Execution events</h2><p>Real runtime line, call, return, and exception events.</p></div></div></div><span className="log-count">{events.length ? `${events.length} EVENTS` : "WAITING FOR A RUN"}</span></div>
        <div className={`log-list ${events.length ? "" : "log-empty"}`}>
          {events.length ? events.map((event, index) => (
            <button key={`${event.sequence}-${event.frameId}`} className={`log-item ${index === position ? "log-item-active" : ""}`} onClick={() => { setPosition(index); setPlaying(false); }}>
              <span className="log-number">{String(index + 1).padStart(2, "0")}</span><span className={`log-kind kind-${event.kind === "line" ? "compare" : event.kind === "exception" ? "done" : "move"}`}>{event.kind.toUpperCase()}</span><span className="log-copy">Line {event.line} · {event.function}()</span><span className="log-chevron">›</span>
            </button>
          )) : <div className="log-placeholder">Run a method to see its actual runtime events.</div>}
        </div>
      </section>
    </section>
  );
}
