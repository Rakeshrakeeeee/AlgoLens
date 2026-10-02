import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  algorithms,
  createTrace,
  detectAlgorithm,
  findSyntaxErrorLine,
  getDecisionInsight,
  mapTraceToSourceLines,
  MAX_SOURCE_LENGTH,
  parseArray,
  snippets,
  type AlgorithmId,
  type Language,
  type Step,
} from "./engine";
import { ExecutionPanel } from "./ExecutionPanel";
import "./styles.css";

const languages: { id: Language; label: string }[] = [
  { id: "cpp", label: "C++" },
  { id: "java", label: "Java" },
  { id: "python", label: "Python" },
  { id: "javascript", label: "JavaScript" },
];

const starterArray: Record<AlgorithmId, string> = {
  "bubble-sort": "8, 3, 6, 1, 5",
  "selection-sort": "8, 3, 6, 1, 5",
  "insertion-sort": "8, 3, 6, 1, 5",
  reverse: "4, 1, 7, 3, 9, 2",
  "pair-sum": "1, 2, 4, 6, 9",
  "binary-search": "1, 3, 5, 7, 9, 11",
  palindrome: "1, 3, 5, 3, 1",
  "remove-duplicates": "1, 1, 2, 2, 3, 4, 4",
};

function App() {
  const [workspaceMode, setWorkspaceMode] = useState<"patterns" | "execution">("patterns");
  const [algorithmId, setAlgorithmId] = useState<AlgorithmId>("bubble-sort");
  const [language, setLanguage] = useState<Language>("javascript");
  const [code, setCode] = useState(snippets["bubble-sort"].javascript);
  const [arrayText, setArrayText] = useState(starterArray["bubble-sort"]);
  const [targetText, setTargetText] = useState("10");
  const [trace, setTrace] = useState<Step[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState("");
  const [errorLine, setErrorLine] = useState<number | null>(null);
  const [completed, setCompleted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(
    () => localStorage.getItem("algolens-theme") === "dark" ? "dark" : "light",
  );
  const algorithm = algorithms.find((item) => item.id === algorithmId)!;
  const currentStep = trace[stepIndex];
  const decisionInsight = currentStep ? getDecisionInsight(currentStep, algorithmId, Number(targetText)) : null;
  const codeLines = code.split("\n");
  const maxValue = Math.max(...(currentStep?.values ?? [1]).map((value) => Math.abs(value)), 1);
  const done = currentStep?.kind === "done";

  useEffect(() => {
    if (!isPlaying || trace.length === 0) return;
    const timer = window.setInterval(() => {
      setStepIndex((current) => {
        if (current >= trace.length - 1) {
          setIsPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 950 / speed);
    return () => window.clearInterval(timer);
  }, [isPlaying, speed, trace]);

  useEffect(() => {
    if (trace.length > 0 && stepIndex === trace.length - 1) setIsPlaying(false);
  }, [stepIndex, trace]);

  useEffect(() => {
    localStorage.setItem("algolens-theme", theme);
  }, [theme]);

  const progress = useMemo(
    () => trace.length > 1 ? (stepIndex / (trace.length - 1)) * 100 : 0,
    [stepIndex, trace.length],
  );

  function invalidateTrace() {
    setTrace([]);
    setStepIndex(0);
    setIsPlaying(false);
    setCompleted(false);
    setError("");
    setErrorLine(null);
  }

  function chooseAlgorithm(id: AlgorithmId) {
    setAlgorithmId(id);
    setCode(snippets[id][language]);
    setArrayText(starterArray[id]);
    setTargetText(id === "binary-search" ? "7" : "10");
    invalidateTrace();
  }

  function chooseLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    setCode(snippets[algorithmId][nextLanguage]);
    invalidateTrace();
  }

  function runVisualizer() {
    setError("");
    setIsPlaying(false);
    try {
      if (code.length > MAX_SOURCE_LENGTH) {
        throw new Error(`Keep source code under ${MAX_SOURCE_LENGTH.toLocaleString()} characters so pattern analysis stays responsive.`);
      }
      const syntaxErrorLine = findSyntaxErrorLine(code, language);
      if (syntaxErrorLine !== null) {
        setErrorLine(syntaxErrorLine);
        throw new Error(`Unclosed or mismatched bracket, quote, or comment on line ${syntaxErrorLine}.`);
      }
      const detectedAlgorithm = detectAlgorithm(code);
      if (!detectedAlgorithm) {
        throw new Error("I couldn't confidently recognize this solution yet. Try a standard array sort or two-pointer pattern; your code is never executed.");
      }
      setAlgorithmId(detectedAlgorithm);
      const values = parseArray(arrayText);
      const needsTarget = detectedAlgorithm === "pair-sum" || detectedAlgorithm === "binary-search";
      if (needsTarget && !/^-?\d+$/.test(targetText.trim())) {
        throw new Error("Enter a whole-number target.");
      }
      const target = Number(targetText);
      if (needsTarget && !Number.isSafeInteger(target)) throw new Error("Enter a whole-number target.");
      const nextTrace = mapTraceToSourceLines(createTrace(detectedAlgorithm, values, target), code, detectedAlgorithm);
      setTrace(nextTrace);
      setStepIndex(0);
      setCompleted(true);
    } catch (cause) {
      setTrace([]);
      setCompleted(false);
      setError(cause instanceof Error ? cause.message : "Could not create this trace. Check your input and try again.");
      setErrorLine(findSyntaxErrorLine(code, language));
    }
  }

  function resetPlayback() {
    setIsPlaying(false);
    setStepIndex(0);
  }

  function setCurrentStep(nextIndex: number) {
    setStepIndex(Math.min(Math.max(nextIndex, 0), trace.length - 1));
  }

  return (
    <div className={`app-shell ${theme === "dark" ? "theme-dark" : ""}`}>
      <header className="topbar">
        <a className="brand" href="#" aria-label="AlgoLens home">
          <span className="brand-mark"><span /><span /><span /></span>
          <span>algo<span className="brand-light">lens</span></span>
          <span className="brand-tag">LEARN BY SEEING</span>
        </a>
        <div className="topbar-right">
          <span className="local-status"><i /> Runs locally</span>
          <button className="theme-toggle" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
            <span aria-hidden="true">{theme === "dark" ? "☼" : "☾"}</span>
          </button>
          <button className="help-button" aria-label="About AlgoLens" title="Your code and inputs stay in this browser session. Nothing is uploaded or saved.">?</button>
        </div>
      </header>

      <main className="workspace">
        <section className="intro">
          <div className="eyebrow"><span className="eyebrow-line" /> THE ALGORITHM PLAYGROUND</div>
          <div className="intro-row">
            <div>
              <h1>Make the invisible <em>visible.</em></h1>
              <p>Step inside your code. See every comparison, every swap, every <span>“aha!”</span> moment.</p>
            </div>
            <div className="step-count">
              <span className="step-count-label">YOUR PROGRESS</span>
              <strong>{String(trace.length ? stepIndex + 1 : 0).padStart(2, "0")}<small> / {String(trace.length).padStart(2, "0")}</small></strong>
              <span className="progress-track"><i style={{ width: `${progress}%` }} /></span>
            </div>
          </div>
        </section>

        <div className="mode-switch" role="group" aria-label="Visualizer mode">
          <button className={workspaceMode === "patterns" ? "mode-active" : ""} onClick={() => setWorkspaceMode("patterns")}>Pattern simulator</button>
          <button className={workspaceMode === "execution" ? "mode-active" : ""} onClick={() => setWorkspaceMode("execution")}>Code execution · Python + Java <span>BETA</span></button>
        </div>

        {workspaceMode === "patterns" ? <>
        <section className="algorithm-strip" aria-label="Choose an algorithm">
          {algorithms.map((item) => (
            <button
              className={`algorithm-card ${item.id === algorithmId ? "selected" : ""}`}
              key={item.id}
              onClick={() => chooseAlgorithm(item.id)}
              aria-pressed={item.id === algorithmId}
            >
              <span className="algorithm-icon">{item.icon}</span>
              <span className="algorithm-card-text"><strong>{item.name}</strong><small>{item.category}</small></span>
              <span className="algorithm-complexity">{item.complexity}</span>
            </button>
          ))}
        </section>

        <div className="main-grid">
          <section className="panel code-panel">
            <div className="panel-heading">
              <div className="panel-title"><span className="panel-icon code-icon">{"</>"}</span><div><h2>Your code</h2><p>Pick a language, then make it yours.</p></div></div>
              <label className="language-select">
                <span className="sr-only">Programming language</span>
                <select value={language} onChange={(event) => chooseLanguage(event.target.value as Language)}>
                  {languages.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
                <span className="select-caret">⌄</span>
              </label>
            </div>
            <div className="editor">
              <div className="editor-top"><span className="file-dot" /> <span>{algorithm.name.toLowerCase().replaceAll(" ", "-")}.{language === "python" ? "py" : language === "java" ? "java" : language === "cpp" ? "cpp" : "js"}</span><span className="editor-readonly">PATTERN AUTO-DETECT</span></div>
              <div className="code-area">
                <div className="line-numbers" aria-hidden="true">{codeLines.map((_, index) => <span className={`${currentStep?.line === index + 1 ? "active-line-number" : ""} ${errorLine === index + 1 ? "error-line-number" : ""}`} key={index}>{String(index + 1).padStart(2, "0")}</span>)}</div>
                <textarea
                  spellCheck={false}
                  aria-label="Algorithm source code"
                  value={code}
                  maxLength={MAX_SOURCE_LENGTH}
                  onChange={(event) => { setCode(event.target.value); invalidateTrace(); }}
                />
                {(errorLine !== null || currentStep) && <div className={`line-highlight ${errorLine !== null ? "line-highlight-error" : ""}`} aria-hidden="true" style={{ top: `${(Math.max(1, errorLine ?? currentStep?.line ?? 1) - 1) * 22 + 7}px` }} />}
              </div>
              <div className="editor-foot"><span className="editor-foot-dot" /> Pattern-level simulation · not a general interpreter <span className="editor-foot-right">Session only · never uploaded or executed</span></div>
            </div>
            {error && <div className={`editor-diagnostic ${errorLine === null ? "diagnostic-info" : ""}`} role="alert"><span className="diagnostic-icon">{errorLine === null ? "i" : "!"}</span><div><strong>{errorLine === null ? "Pattern not recognized" : `Syntax error · line ${errorLine}`}</strong><p>{error}</p></div></div>}
            <div className="input-controls">
              <label className="input-label" htmlFor="array-input"><span>INPUT ARRAY</span><input id="array-input" value={arrayText} onChange={(event) => { setArrayText(event.target.value); invalidateTrace(); }} placeholder="e.g. 8, 3, 6, 1, 5" /></label>
              {(algorithmId === "pair-sum" || algorithmId === "binary-search") && <label className="input-label target-input" htmlFor="target-input"><span>TARGET</span><input id="target-input" value={targetText} onChange={(event) => { setTargetText(event.target.value); invalidateTrace(); }} inputMode="numeric" /></label>}
            </div>
            {algorithmId === "pair-sum" || algorithmId === "remove-duplicates" || algorithmId === "binary-search" ? <div className="input-hint"><span>↳</span> This pattern expects the input array to be sorted.</div> : null}
            {completed && <div className="success-message"><span>✓</span> Trace ready — use the controls to explore.</div>}
            <button className="run-button" onClick={runVisualizer}><span>▶</span> Visualize algorithm <span className="run-arrow">↗</span></button>
          </section>

          <section className="panel visual-panel">
            <div className="panel-heading visual-heading">
              <div className="panel-title"><span className="panel-icon visual-icon">▥</span><div><h2>Live visualization</h2><p>{algorithm.description}</p></div></div>
              <span className="live-badge"><i /> LIVE</span>
            </div>
            <div className="visual-canvas">
              {currentStep ? (
                <>
                  <div className="canvas-topline"><span>ARRAY STATE</span><span className="canvas-step">STEP {String(stepIndex + 1).padStart(2, "0")}</span></div>
                  <div className="bar-chart" role="img" aria-label={`Array values: ${currentStep.values.join(", ")}`}>
                    {currentStep.values.map((value, index) => {
                      const active = currentStep.highlighted.includes(index);
                      const pointerNames = Object.entries(currentStep.pointers).filter(([, at]) => at === index).map(([name]) => name);
                      const height = Math.max(12, (Math.abs(value) / maxValue) * 74);
                      return (
                        <div className="bar-column" key={`${index}-${value}`}>
                          <div className="pointer-labels">{pointerNames.map((name) => <span className={`pointer-tag pointer-${name}`} key={name}>{name}</span>)}</div>
                          <div className={`array-bar ${active ? "bar-active" : ""} ${currentStep.kind === "swap" && active ? "bar-swap" : ""}`} style={{ height: `${height}%` }}>
                            <span>{value}</span>
                          </div>
                          <span className={`bar-index ${active ? "index-active" : ""}`}>{index}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="chart-axis"><span>INDEX</span><span>VALUE</span></div>
                </>
              ) : (
                <div className="empty-canvas"><div className="empty-illustration"><span>↔</span><i /><i /><i /><i /><i /></div><strong>Your array, in motion.</strong><p>Run the visualizer to see each value<br />move through the algorithm.</p></div>
              )}
            </div>
            <section className="memory-inspector" aria-label="Variables and memory">
              <div className="memory-heading"><div><strong>Variables & memory</strong><span>LIVE SNAPSHOT</span></div><small>{currentStep ? `STEP ${String(stepIndex + 1).padStart(2, "0")}` : "RUN TO INSPECT"}</small></div>
              {currentStep ? (
                <div className="memory-content">
                  <div className="variable-list">
                    <span className="memory-section-label">LOCAL VARIABLES</span>
                    {Object.entries(currentStep.variables).map(([name, value]) => {
                      const previousValue = trace[stepIndex - 1]?.variables[name];
                      const changed = stepIndex > 0 && previousValue !== value;
                      return <div className={`variable-row ${changed ? "variable-changed" : ""}`} key={name}><span>{name}</span><code>{String(value)}</code>{changed && <i>changed</i>}</div>;
                    })}
                  </div>
                  <div className="heap-list">
                    <span className="memory-section-label">HEAP OBJECTS</span>
                    {currentStep.heap.map((object) => (
                      <div className="heap-object" key={object.address}>
                        <div className="heap-object-title"><span>{object.address}</span><small>{object.type}</small></div>
                        <div className="heap-cells">{object.values.map((value, index) => {
                          const changed = stepIndex > 0 && trace[stepIndex - 1]?.values[index] !== value;
                          return <div className={`heap-cell ${changed ? "heap-cell-changed" : ""}`} key={`${index}-${value}`}><small>{index}</small><strong>{value}</strong></div>;
                        })}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <p className="memory-empty">Run a pattern trace to inspect its modeled variables and array memory.</p>}
            </section>
            <div className={`current-explanation ${done ? "is-done" : ""}`}>
              <span className="explanation-spark">{done ? "✓" : "→"}</span>
              <div><span className="explanation-label">{done ? "NICE WORK — YOU MADE IT" : currentStep?.kind === "start" ? "LET’S GET STARTED" : "WHAT’S HAPPENING"}</span><p>{currentStep?.explanation ?? "Every step tells a little part of the story."}</p></div>
            </div>
            {decisionInsight && <div className="decision-lens"><span className="lens-icon">◎</span><div><span>DECISION LENS <i>WHY THIS MOVE?</i></span><p>{decisionInsight}</p></div></div>}
            <div className="playback">
              <div className="playback-buttons">
                <button className="control-button" onClick={resetPlayback} disabled={!trace.length} aria-label="Reset"><span>↺</span></button>
                <button className="control-button" onClick={() => setCurrentStep(stepIndex - 1)} disabled={!trace.length || stepIndex === 0} aria-label="Previous step"><span>‹</span></button>
                <button className="play-button" onClick={() => { if (trace.length) { if (stepIndex === trace.length - 1) setStepIndex(0); setIsPlaying(!isPlaying); } }} disabled={!trace.length} aria-label={isPlaying ? "Pause" : "Play"}><span>{isPlaying ? "Ⅱ" : "▶"}</span></button>
                <button className="control-button" onClick={() => setCurrentStep(stepIndex + 1)} disabled={!trace.length || stepIndex >= trace.length - 1} aria-label="Next step"><span>›</span></button>
              </div>
              <label className="speed-control"><span>SPEED</span><select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}><option value={0.7}>0.7×</option><option value={1}>1×</option><option value={1.5}>1.5×</option><option value={2}>2×</option></select></label>
            </div>
            <div className="scrubber-wrap"><input aria-label="Trace position" type="range" min="0" max={Math.max(0, trace.length - 1)} value={trace.length ? stepIndex : 0} onChange={(event) => setCurrentStep(Number(event.target.value))} style={{ "--range-progress": `${progress}%` } as React.CSSProperties} disabled={!trace.length} /><div><span>START</span><span>{trace.length ? `${trace.length} STEPS` : "NO TRACE YET"}</span></div></div>
          </section>
        </div>

        <section className="panel log-panel">
          <div className="log-heading"><div className="panel-title"><span className="panel-icon log-icon">≡</span><div><h2>Step-by-step story</h2><p>A plain-English guide to the algorithm’s thinking.</p></div></div><span className="log-count">{trace.length ? `${trace.length} STEPS` : "WAITING FOR A RUN"}</span></div>
          <div className={`log-list ${trace.length ? "" : "log-empty"}`}>
            {trace.length ? trace.map((step, index) => (
              <button key={`${step.kind}-${index}`} className={`log-item ${index === stepIndex ? "log-item-active" : ""}`} onClick={() => setCurrentStep(index)}>
                <span className="log-number">{String(index + 1).padStart(2, "0")}</span><span className={`log-kind kind-${step.kind}`}>{step.kind === "start" ? "START" : step.kind.toUpperCase()}</span><span className="log-copy">{step.explanation}</span><span className="log-chevron">›</span>
              </button>
            )) : <div className="log-placeholder">Your step-by-step explanation will appear here.</div>}
          </div>
        </section>
        </> : <ExecutionPanel />}
        <footer className="footer"><span>ALGO<span>LENS</span> <i>·</i> A clearer way to think through code.</span><span>MADE FOR THE “OH, I GET IT” MOMENT</span></footer>
      </main>
    </div>
  );
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("The app root element is missing.");

const root = createRoot(rootElement);
root.render(<React.StrictMode><App /></React.StrictMode>);

if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
