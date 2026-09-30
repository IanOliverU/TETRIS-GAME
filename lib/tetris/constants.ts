// ─── Classic Tetris constants ────────────────────────────────────────────────
export const COLS = 10;
export const ROWS = 20;
export const HIDDEN_ROWS = 2;
export const TOTAL_ROWS = ROWS + HIDDEN_ROWS;

export type TetrominoType = "I" | "O" | "T" | "S" | "Z" | "J" | "L";
export type Cell = 0 | TetrominoType | "G";

export const COLORS: Record<TetrominoType, { main: string; dark: string; glow: string }> = {
  I: { main: "#22d3ee", dark: "#0e7490", glow: "rgba(34,211,238,0.55)" },
  O: { main: "#facc15", dark: "#a16207", glow: "rgba(250,204,21,0.55)" },
  T: { main: "#a855f7", dark: "#6b21a8", glow: "rgba(168,85,247,0.55)" },
  S: { main: "#22c55e", dark: "#15803d", glow: "rgba(34,197,94,0.55)" },
  Z: { main: "#ef4444", dark: "#991b1b", glow: "rgba(239,68,68,0.55)" },
  J: { main: "#3b82f6", dark: "#1e40af", glow: "rgba(59,130,246,0.55)" },
  L: { main: "#fb923c", dark: "#9a3412", glow: "rgba(251,146,60,0.55)" },
};

export const ALL_PIECES: TetrominoType[] = ["I", "O", "T", "S", "Z", "J", "L"];

/** Base spawn matrices (SRS spawn orientation). */
const BASE: Record<TetrominoType, number[][]> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
};

function rotateMatrixCW(m: number[][]): number[][] {
  const n = m.length;
  const out: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) out[x][n - 1 - y] = m[y][x];
  return out;
}

/** Precomputed 4 SRS rotation states per piece. */
export const SHAPES: Record<TetrominoType, number[][][]> = (() => {
  const out = {} as Record<TetrominoType, number[][][]>;
  for (const p of ALL_PIECES) {
    const states: number[][][] = [BASE[p]];
    for (let i = 1; i < 4; i++) states.push(rotateMatrixCW(states[i - 1]));
    out[p] = states;
  }
  return out;
})();

type XY = [number, number];

/**
 * SRS wall-kick tables. y+ in spec = up; our board y+ = down, so signs flipped.
 * Key: `${from}->${to}`
 */
const JLSTZ_KICKS: Record<string, XY[]> = {
  "0->1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  "1->0": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  "1->2": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  "2->1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  "2->3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  "3->2": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  "3->0": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  "0->3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
};

const I_KICKS: Record<string, XY[]> = {
  "0->1": [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  "1->0": [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  "1->2": [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
  "2->1": [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  "2->3": [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  "3->2": [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  "3->0": [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  "0->3": [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
};

export function getKicks(
  type: TetrominoType,
  from: number,
  to: number
): XY[] {
  if (type === "O") return [[0, 0]];
  if (type === "I") return I_KICKS[`${from}->${to}`] ?? [[0, 0]];
  return JLSTZ_KICKS[`${from}->${to}`] ?? [[0, 0]];
}

/** Seeded RNG (mulberry32) so rooms can share the same piece sequence. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Gravity: ms per row for a level. */
export function dropIntervalMs(level: number): number {
  return Math.max(28, Math.round(800 * Math.pow(0.85, level - 1)));
}

export const SCORE_TABLE = { single: 100, double: 300, triple: 500, tetris: 800 } as const;
