import { useRef, useEffect, useState, useCallback } from "react";
import {
  Exam,
  initSearch,
  stepSearch,
  type HarmonySearchOptions,
  type SearchState,
  type Harmony,
  type QualityFn,
  parseSudokuPuzzle,
  sudokuQuality,
  buildSudokuGrid,
  getSudokuViolations,
  SUDOKU_PUZZLES,
  type SudokuPuzzle,
} from "@/lib/harmony-search";

// ---- Exam Heatmap ----

export function ExamHeatmap({ width = 200, height = 200 }: { width?: number; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const imgData = ctx.createImageData(width, height);

    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        const x = (px / width) * 100;
        const y = (py / height) * 100;
        const mark = Exam.mark(x, y);
        const t = mark / 100;
        // Black to white color scale
        const v = Math.floor(t * 255);
        const idx = (py * width + px) * 4;
        imgData.data[idx] = v;
        imgData.data[idx + 1] = v;
        imgData.data[idx + 2] = v;
        imgData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }, [width, height]);

  return (
    <div>
      <canvas ref={canvasRef} width={width} height={height} style={{ display: "block", maxWidth: "100%" }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#888", marginTop: 2 }}>
        <span>0 hrs studying →</span>
        <span>← 10 hrs studying</span>
      </div>
      <div style={{ fontSize: 11, color: "#888" }}>↕ Hours sleeping (0–10)</div>
    </div>
  );
}

// ---- Harmony Memory Ring ----

function HarmonyRing({
  harmonies,
  best,
  worst,
  targetQuality,
  size = 300,
}: {
  harmonies: Harmony[];
  best: Harmony | null;
  worst: Harmony | null;
  targetQuality: number;
  size?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;
    const innerR = size / 2 - 70;
    const outerR = size / 2 - 10;
    const n = harmonies.length;
    if (n === 0) return;

    const angleStep = (2 * Math.PI) / n;

    for (let i = 0; i < n; i++) {
      const h = harmonies[i];
      const startAngle = i * angleStep - Math.PI / 2;
      const endAngle = startAngle + angleStep;

      // Color: interpolate from dark to purple based on quality
      const t = Math.min(1, Math.max(0, h.quality / targetQuality));
      const r = Math.floor(128 * t);
      const g = Math.floor(30 * t);
      const b = Math.floor(128 + 127 * t);

      ctx.beginPath();
      ctx.arc(cx, cy, outerR, startAngle, endAngle);
      ctx.arc(cx, cy, innerR, endAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = h.quality >= targetQuality ? "#A0FF8C" : `rgb(${r},${g},${b})`;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Best/worst indicator
      if (best && h.quality === best.quality) {
        ctx.beginPath();
        ctx.arc(cx, cy, innerR - 1, startAngle, endAngle);
        ctx.arc(cx, cy, innerR - 5, endAngle, startAngle, true);
        ctx.closePath();
        ctx.fillStyle = "green";
        ctx.fill();
      } else if (worst && h.quality === worst.quality) {
        ctx.beginPath();
        ctx.arc(cx, cy, innerR - 1, startAngle, endAngle);
        ctx.arc(cx, cy, innerR - 5, endAngle, startAngle, true);
        ctx.closePath();
        ctx.fillStyle = "red";
        ctx.fill();
      }

      // Quality label
      const midAngle = (startAngle + endAngle) / 2;
      const labelR = (innerR + outerR) / 2;
      const lx = cx + Math.cos(midAngle) * labelR;
      const ly = cy + Math.sin(midAngle) * labelR;
      ctx.fillStyle = "#000";
      ctx.font = "9px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(Math.round(h.quality * 100) / 100), lx, ly);
    }
  }, [harmonies, best, worst, targetQuality, size]);

  return <canvas ref={canvasRef} width={size} height={size} style={{ display: "block", maxWidth: "100%" }} />;
}

// ---- Exam Search Demo ----

export function ExamSearchDemo() {
  const [state, setState] = useState<SearchState | null>(null);
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  const stateRef = useRef<SearchState | null>(null);
  const optsRef = useRef<HarmonySearchOptions | null>(null);

  const qualityFn: QualityFn = useCallback((notes: number[]) => {
    return Exam.mark(notes[0] * 10, notes[1] * 10);
  }, []);

  const initOpts = useCallback((): HarmonySearchOptions => ({
    maxTries: 10000,
    targetQuality: 98,
    harmonyMemoryConsiderationRate: 0.7,
    pitchAdjustmentRate: 0.1,
    harmonyMemorySize: 16,
    instruments: 2,
    notes: Array.from({ length: 101 }, (_, i) => i / 10),
    notesGlobal: true,
    popStack: 1,
  }), []);

  const reset = useCallback(() => {
    const opts = initOpts();
    optsRef.current = opts;
    const s = initSearch(opts, qualityFn);
    setState(s);
    stateRef.current = s;
    runningRef.current = false;
    setRunning(false);
  }, [initOpts, qualityFn]);

  useEffect(() => { reset(); }, [reset]);

  useEffect(() => {
    if (!running) return;
    let raf: number;
    const tick = () => {
      if (!runningRef.current || !stateRef.current || !optsRef.current) return;
      const result = stepSearch(stateRef.current, optsRef.current, qualityFn, 5);
      stateRef.current = result.state;
      setState({ ...result.state });
      if (result.state.finished) {
        runningRef.current = false;
        setRunning(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, qualityFn]);

  const toggle = () => {
    if (running) {
      runningRef.current = false;
      setRunning(false);
    } else {
      runningRef.current = true;
      setRunning(true);
    }
  };

  if (!state) return null;

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
      <div>
        <HarmonyRing
          harmonies={state.harmonyMemory}
          best={state.best}
          worst={state.worst}
          targetQuality={98}
          size={280}
        />
      </div>
      <div style={{ flex: 1, minWidth: 200 }}>
        <ExamHeatmap width={200} height={200} />
        <div style={{ marginTop: 8, fontSize: 13 }}>
          <div>Try {state.tries}. Best: {Math.round(state.best.quality * 100) / 100}</div>
          <div>Best inputs: study {(state.best.notes[0] * 10).toFixed(1)}h, sleep {(state.best.notes[1] * 10).toFixed(1)}h</div>
          {state.finished && <div style={{ color: "green", fontWeight: "bold" }}>Solution found!</div>}
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
          <button onClick={toggle} style={btnStyle}>{running ? "Pause" : "Start"}</button>
          <button onClick={reset} style={btnStyle}>Reset</button>
        </div>
      </div>
    </div>
  );
}

// ---- Sudoku Grid ----

function SudokuGrid({ puzzle, grid, violations }: {
  puzzle: SudokuPuzzle;
  grid: number[][];
  violations: boolean[][];
}) {
  return (
    <table style={{ borderCollapse: "collapse", fontSize: 14, fontFamily: "monospace" }}>
      <tbody>
        {grid.map((row, y) => (
          <tr key={y}>
            {row.map((val, x) => {
              const isFixed = puzzle.nums[y][x] !== null;
              const isViolated = !isFixed && violations[y]?.[x];
              const bg = isFixed ? "#fff" : isViolated ? "#fcc" : "#cfc";
              const borderRight = x % 3 === 2 && x < 8 ? "2px solid #000" : "1px solid #999";
              const borderBottom = y % 3 === 2 && y < 8 ? "2px solid #000" : "1px solid #999";
              return (
                <td
                  key={x}
                  style={{
                    width: 28,
                    height: 28,
                    textAlign: "center",
                    background: bg,
                    borderRight,
                    borderBottom,
                    borderTop: y === 0 ? "2px solid #000" : undefined,
                    borderLeft: x === 0 ? "2px solid #000" : undefined,
                    fontWeight: isFixed ? "bold" : "normal",
                    color: isFixed ? "#000" : isViolated ? "#c00" : "#060",
                  }}
                >
                  {val}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---- Sudoku Search Demo ----

export function SudokuSearchDemo() {
  const [puzzleName, setPuzzleName] = useState("geem");
  const [state, setState] = useState<SearchState | null>(null);
  const [running, setRunning] = useState(false);
  const [bestGrid, setBestGrid] = useState<number[][] | null>(null);
  const [violations, setViolations] = useState<boolean[][] | null>(null);
  const runningRef = useRef(false);
  const stateRef = useRef<SearchState | null>(null);
  const optsRef = useRef<HarmonySearchOptions | null>(null);
  const puzzleRef = useRef<SudokuPuzzle | null>(null);
  const qualityFnRef = useRef<QualityFn | null>(null);

  const initForPuzzle = useCallback((name: string) => {
    const puzzleStr = SUDOKU_PUZZLES[name];
    const puzzle = parseSudokuPuzzle(puzzleStr);
    puzzleRef.current = puzzle;
    const qFn = sudokuQuality(puzzle);
    qualityFnRef.current = qFn;

    const opts: HarmonySearchOptions = {
      maxTries: 500000,
      targetQuality: 135,
      harmonyMemoryConsiderationRate: 0.7,
      pitchAdjustmentRate: 0.1,
      harmonyMemorySize: 16,
      instruments: puzzle.unsolvedCount,
      notes: puzzle.possibilities,
      notesGlobal: false,
      popStack: 1,
    };
    optsRef.current = opts;

    const s = initSearch(opts, qFn);
    stateRef.current = s;
    setState(s);

    const grid = buildSudokuGrid(puzzle, s.best.notes);
    setBestGrid(grid);
    setViolations(getSudokuViolations(puzzle, grid));

    runningRef.current = false;
    setRunning(false);
  }, []);

  useEffect(() => { initForPuzzle(puzzleName); }, [puzzleName, initForPuzzle]);

  useEffect(() => {
    if (!running) return;
    let raf: number;
    const tick = () => {
      if (!runningRef.current || !stateRef.current || !optsRef.current || !qualityFnRef.current) return;
      const result = stepSearch(stateRef.current, optsRef.current, qualityFnRef.current, 50);
      stateRef.current = result.state;
      setState({ ...result.state });

      if (puzzleRef.current) {
        const grid = buildSudokuGrid(puzzleRef.current, result.state.best.notes);
        setBestGrid(grid);
        setViolations(getSudokuViolations(puzzleRef.current, grid));
      }

      if (result.state.finished) {
        runningRef.current = false;
        setRunning(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  const toggle = () => {
    if (running) {
      runningRef.current = false;
      setRunning(false);
    } else {
      runningRef.current = true;
      setRunning(true);
    }
  };

  if (!state || !bestGrid || !violations || !puzzleRef.current) return null;

  const violationCount = violations.flat().filter(Boolean).length;
  const totalUnknown = puzzleRef.current.unsolvedCount;

  return (
    <div>
      <div style={{ marginBottom: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={toggle} style={btnStyle}>{running ? "Pause" : "Start"}</button>
        <button onClick={() => initForPuzzle(puzzleName)} style={btnStyle}>Reset</button>
        <label style={{ fontSize: 13 }}>
          Puzzle:{" "}
          <select value={puzzleName} onChange={(e) => setPuzzleName(e.target.value)} style={selectStyle}>
            {Object.keys(SUDOKU_PUZZLES).map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          <HarmonyRing
            harmonies={state.harmonyMemory}
            best={state.best}
            worst={state.worst}
            targetQuality={135}
            size={280}
          />
        </div>
        <div>
          <SudokuGrid puzzle={puzzleRef.current} grid={bestGrid} violations={violations} />
          <div style={{ marginTop: 8, fontSize: 13 }}>
            <div>Try {state.tries}. Quality: {Math.round(state.best.quality)}/135</div>
            <div>Violations: {violationCount}/{totalUnknown}</div>
            {state.best.quality >= 135 && (
              <div style={{ color: "green", fontWeight: "bold" }}>Solved!</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "4px 12px",
  fontSize: 13,
  cursor: "pointer",
  background: "#f0f0f0",
  border: "1px solid #ccc",
  borderRadius: 4,
};

const selectStyle: React.CSSProperties = {
  padding: "2px 8px",
  fontSize: 13,
  borderRadius: 4,
  border: "1px solid #ccc",
};
