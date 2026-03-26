// Harmony Search algorithm - ported from CoffeeScript implementation

export interface HarmonySearchOptions {
  maxTries: number;
  targetQuality: number;
  harmonyMemoryConsiderationRate: number;
  pitchAdjustmentRate: number;
  harmonyMemorySize: number;
  instruments: number;
  notes: number[][] | number[]; // per-instrument or global
  notesGlobal: boolean;
  popStack: number;
}

export interface Harmony {
  notes: number[];
  noteIndices: number[];
  quality: number;
  creationAnnotations?: AnnotationInfo[];
}

export interface AnnotationInfo {
  fromMemory?: boolean;
  memoryIndex?: number;
  pitchAdjusted?: boolean;
  random?: boolean;
  noteIndex?: number;
}

export interface SearchState {
  harmonyMemory: Harmony[];
  tries: number;
  best: Harmony;
  worst: Harmony;
  running: boolean;
  finished: boolean;
}

export type QualityFn = (notes: number[]) => number;

function getRandomHarmony(opts: HarmonySearchOptions, qualityFn: QualityFn): Harmony {
  const notes: number[] = [];
  const noteIndices: number[] = [];
  for (let i = 0; i < opts.instruments; i++) {
    const available = opts.notesGlobal ? (opts.notes as number[]) : (opts.notes as number[][])[i];
    const idx = Math.floor(Math.random() * available.length);
    notes.push(available[idx]);
    noteIndices.push(idx);
  }
  return { notes, noteIndices, quality: qualityFn(notes) };
}

function getNextHarmony(
  opts: HarmonySearchOptions,
  memory: Harmony[],
  qualityFn: QualityFn,
): Harmony {
  const notes: number[] = [];
  const noteIndices: number[] = [];
  const annotations: AnnotationInfo[] = [];

  for (let i = 0; i < opts.instruments; i++) {
    const available = opts.notesGlobal ? (opts.notes as number[]) : (opts.notes as number[][])[i];
    const annotation: AnnotationInfo = {};

    if (available.length === 1) {
      notes.push(available[0]);
      noteIndices.push(0);
      annotations.push(annotation);
      continue;
    }

    if (Math.random() < opts.harmonyMemoryConsiderationRate) {
      const memIdx = Math.floor(Math.random() * opts.harmonyMemorySize);
      let note = memory[memIdx].notes[i];
      let noteIdx = memory[memIdx].noteIndices[i];
      annotation.fromMemory = true;
      annotation.memoryIndex = memIdx;

      if (Math.random() < opts.pitchAdjustmentRate) {
        annotation.pitchAdjusted = true;
        const adj = Math.random() > 0.5 ? 1 : -1;
        noteIdx = (noteIdx + adj + available.length) % available.length;
        note = available[noteIdx];
      }
      notes.push(note);
      noteIndices.push(noteIdx);
    } else {
      const noteIdx = Math.floor(Math.random() * available.length);
      notes.push(available[noteIdx]);
      noteIndices.push(noteIdx);
      annotation.random = true;
    }
    annotation.noteIndex = noteIndices[noteIndices.length - 1];
    annotations.push(annotation);
  }

  const h: Harmony = { notes, noteIndices, quality: qualityFn(notes), creationAnnotations: annotations };
  return h;
}

function getWorst(memory: Harmony[]): [number, number] {
  let quality = Infinity;
  let index = 0;
  for (let i = 0; i < memory.length; i++) {
    if (memory[i].quality < quality) {
      quality = memory[i].quality;
      index = i;
    }
  }
  return [quality, index];
}

function getBest(memory: Harmony[]): [number, number] {
  let quality = -Infinity;
  let index = 0;
  for (let i = 0; i < memory.length; i++) {
    if (memory[i].quality > quality) {
      quality = memory[i].quality;
      index = i;
    }
  }
  return [quality, index];
}

/**
 * Run a batch of harmony search iterations.
 * Returns the updated state. Call repeatedly with requestAnimationFrame for animation.
 */
export function initSearch(opts: HarmonySearchOptions, qualityFn: QualityFn): SearchState {
  // Init memory with random harmonies, keep best ones
  const randoms: Harmony[] = [];
  for (let i = 0; i < opts.harmonyMemorySize * 3; i++) {
    randoms.push(getRandomHarmony(opts, qualityFn));
  }
  randoms.sort((a, b) => b.quality - a.quality);
  const memory = randoms.slice(0, opts.harmonyMemorySize);

  const [bestQ, bestI] = getBest(memory);
  const [worstQ, worstI] = getWorst(memory);

  return {
    harmonyMemory: memory,
    tries: 0,
    best: memory[bestI],
    worst: memory[worstI],
    running: false,
    finished: false,
  };
}

export function stepSearch(
  state: SearchState,
  opts: HarmonySearchOptions,
  qualityFn: QualityFn,
  batchSize: number = 10,
): { state: SearchState; newHarmonies: Harmony[] } {
  const memory = [...state.harmonyMemory];
  let tries = state.tries;
  let best = state.best;
  const newHarmonies: Harmony[] = [];

  for (let b = 0; b < batchSize; b++) {
    if (tries >= opts.maxTries || best.quality >= opts.targetQuality) {
      return {
        state: { ...state, harmonyMemory: memory, tries, best, finished: true },
        newHarmonies,
      };
    }

    const harmony = getNextHarmony(opts, memory, qualityFn);
    const [worstQ, worstI] = getWorst(memory);

    if (harmony.quality > worstQ) {
      memory.push(harmony);
      memory.splice(worstI, 1);
      newHarmonies.push(harmony);

      if (harmony.quality > best.quality) {
        best = harmony;
      }
    }
    tries++;
  }

  const [, worstI] = getWorst(memory);

  return {
    state: {
      harmonyMemory: memory,
      tries,
      best,
      worst: memory[worstI],
      running: true,
      finished: false,
    },
    newHarmonies,
  };
}

// ---- Exam mark problem ----

export const Exam = (() => {
  function implMark(x: number, y: number): number {
    const nx = (x - 50) / 26;
    const ny = (y - 50) / 26;
    let a = 3 * Math.cos(Math.pow(nx - 1, 2) + Math.pow(ny, 2));
    a += 2 * Math.cos(Math.pow(nx - 3, 2) + Math.pow(ny + 4, 2));
    a += 2 * Math.pow(Math.cos(nx) + Math.cos(ny + 1), 3);
    a += 2 * Math.pow(Math.abs(Math.cos(0.4 * nx + 3) + Math.cos(0.6 * ny - 2)), 0.5);
    a -= 3 * Math.pow(Math.pow(nx + 2, 2) + Math.pow(ny, 2), 0.5);
    a -= 3 * Math.pow(Math.pow(nx, 2) + Math.pow(ny - 1, 2), 0.5);
    return a;
  }

  let implMax = -Infinity;
  let implMin = Infinity;
  for (let x = 0; x <= 100; x++) {
    for (let y = 0; y <= 100; y++) {
      const n = implMark(x, y);
      if (n > implMax) implMax = n;
      if (n < implMin) implMin = n;
    }
  }

  return {
    mark: (x: number, y: number): number => {
      return ((implMark(x, y) - implMin) / (implMax - implMin)) * 100;
    },
  };
})();

// ---- Sudoku problem ----

export interface SudokuPuzzle {
  nums: (number | null)[][];
  unsolvedCount: number;
  possibilities: number[][];
}

export function parseSudokuPuzzle(puzzle: string): SudokuPuzzle {
  const nums: (number | null)[][] = [];
  let unsolvedCount = 0;

  for (let row = 0; row < 9; row++) {
    nums[row] = [];
    for (let col = 0; col < 9; col++) {
      const char = puzzle.charAt(row * 9 + col);
      if (char === ".") {
        nums[row][col] = null;
        unsolvedCount++;
      } else {
        nums[row][col] = parseInt(char);
      }
    }
  }

  // Calculate possibilities for each unknown cell
  const possibilities: number[][] = [];
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 9; x++) {
      if (nums[y][x] !== null) continue;
      const possible = [true, true, true, true, true, true, true, true, true];

      // Row elimination
      for (let ox = 0; ox < 9; ox++) {
        if (ox !== x && nums[y][ox] !== null) possible[nums[y][ox]! - 1] = false;
      }
      // Column elimination
      for (let oy = 0; oy < 9; oy++) {
        if (oy !== y && nums[oy][x] !== null) possible[nums[oy][x]! - 1] = false;
      }
      // Block elimination
      const by = Math.floor(y / 3) * 3;
      const bx = Math.floor(x / 3) * 3;
      for (let oy = by; oy < by + 3; oy++) {
        for (let ox = bx; ox < bx + 3; ox++) {
          if (oy !== y && ox !== x && nums[oy][ox] !== null) possible[nums[oy][ox]! - 1] = false;
        }
      }

      const vals: number[] = [];
      for (let i = 0; i < 9; i++) {
        if (possible[i]) vals.push(i + 1);
      }
      possibilities.push(vals.length > 0 ? vals : [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    }
  }

  return { nums, unsolvedCount, possibilities };
}

export function buildSudokuGrid(puzzle: SudokuPuzzle, notes: number[]): number[][] {
  const grid: number[][] = [];
  let k = 0;
  for (let row = 0; row < 9; row++) {
    grid[row] = [];
    for (let col = 0; col < 9; col++) {
      grid[row][col] = puzzle.nums[row][col] !== null ? puzzle.nums[row][col]! : notes[k++];
    }
  }
  return grid;
}

export function sudokuQuality(puzzle: SudokuPuzzle): QualityFn {
  return (notes: number[]) => {
    const grid = buildSudokuGrid(puzzle, notes);

    let violations = 0;
    // Row uniqueness
    for (let row = 0; row < 9; row++) {
      violations += 9 - new Set(grid[row]).size;
    }
    // Column uniqueness
    for (let col = 0; col < 9; col++) {
      const colVals = [];
      for (let row = 0; row < 9; row++) colVals.push(grid[row][col]);
      violations += 9 - new Set(colVals).size;
    }
    // Box uniqueness
    for (let by = 0; by < 9; by += 3) {
      for (let bx = 0; bx < 9; bx += 3) {
        const boxVals = [];
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) boxVals.push(grid[by + r][bx + c]);
        }
        violations += 9 - new Set(boxVals).size;
      }
    }
    return 135 - violations;
  };
}

export function getSudokuViolations(puzzle: SudokuPuzzle, grid: number[][]): boolean[][] {
  const violations: boolean[][] = [];
  for (let y = 0; y < 9; y++) {
    violations[y] = [];
    for (let x = 0; x < 9; x++) {
      if (puzzle.nums[y][x] !== null) {
        violations[y][x] = false;
        continue;
      }
      const val = grid[y][x];
      let v = false;
      // Row
      for (let ox = 0; ox < 9; ox++) {
        if (ox !== x && grid[y][ox] === val) { v = true; break; }
      }
      if (!v) {
        // Column
        for (let oy = 0; oy < 9; oy++) {
          if (oy !== y && grid[oy][x] === val) { v = true; break; }
        }
      }
      if (!v) {
        // Block
        const by = Math.floor(y / 3) * 3;
        const bx = Math.floor(x / 3) * 3;
        outer: for (let oy = by; oy < by + 3; oy++) {
          for (let ox = bx; ox < bx + 3; ox++) {
            if (oy !== y && ox !== x && grid[oy][ox] === val) { v = true; break outer; }
          }
        }
      }
      violations[y][x] = v;
    }
  }
  return violations;
}

export const SUDOKU_PUZZLES: Record<string, string> = {
  "stupid easy": "8...37429743.9286..52..4371.8524.7933..87615..74.5968...7465938.369..2474987..516",
  "easy": ".6...14.98......7...16.93..43...7..22..9....7.18......1...2........4..........8..",
  "geem": ".5.3.6..7....85.24.9842.6.39.1..32.6.3.....1.5.726.9.84.5.9.38..1.57...28..1.4.7.",
  "hard": "164....79....3......9...6.53...2...1......432....6.....96.53.....7..4........9.5.",
  "starburst": "9..1.4..2.8..6..7..........4.......1.7.....3.3.......7..........3..7..8.1..2.9..4",
};
