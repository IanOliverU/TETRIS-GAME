import {
  ALL_PIECES,
  Cell,
  COLS,
  HIDDEN_ROWS,
  ROWS,
  SCORE_TABLE,
  SHAPES,
  TOTAL_ROWS,
  TetrominoType,
  dropIntervalMs,
  getKicks,
  mulberry32,
} from "./constants";

export type GameStatus = "idle" | "playing" | "clearing" | "over";

export interface ActivePiece {
  type: TetrominoType;
  rotation: number; // 0..3
  x: number; // col of bounding-box top-left
  y: number; // row of bounding-box top-left (includes hidden rows)
}

export interface LockResult {
  locked: boolean;
  clearedRows: number[];
  gained: number;
  lines: number;
  isTetris: boolean;
  tspin: boolean;
  combo: number;
  b2b: boolean;
  b2bBefore: boolean;
  level: number;
  gameOver: boolean;
  toppedOut: boolean;
}

export interface EngineSnapshot {
  board: Cell[][];
  active: ActivePiece | null;
  ghostY: number | null;
  hold: TetrominoType | null;
  canHold: boolean;
  queue: TetrominoType[];
  score: number;
  lines: number;
  level: number;
  combo: number;
  b2b: boolean;
  status: GameStatus;
  clearingRows: number[];
  piecesPlaced: number;
}

/** Reusable Tetris engine — no React dependency. Multiplayer syncs snapshots. */
export class TetrisEngine {
  board: Cell[][] = [];
  active: ActivePiece | null = null;
  hold: TetrominoType | null = null;
  canHold = true;
  queue: TetrominoType[] = [];
  score = 0;
  lines = 0;
  level = 1;
  combo = -1;
  b2b = false;
  status: GameStatus = "idle";
  clearingRows: number[] = [];
  piecesPlaced = 0;
  softDropPoints = 0;
  private lastRotated = false;

  private bag: TetrominoType[] = [];
  private rand: () => number;

  constructor(seed?: number) {
    const s = seed ?? Math.floor(Math.random() * 2 ** 31);
    this.rand = mulberry32(s);
    this.reset();
  }

  /** Re-seed mid-session (shared room seed on game start). Clears queue/bag. */
  setSeed(seed: number) {
    this.rand = mulberry32(seed >>> 0);
    this.bag = [];
    this.queue = [];
    this.refillQueue();
  }

  reset() {
    this.board = Array.from({ length: TOTAL_ROWS }, () =>
      Array<Cell>(COLS).fill(0)
    );
    this.active = null;
    this.hold = null;
    this.canHold = true;
    this.queue = [];
    this.bag = [];
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.combo = -1;
    this.b2b = false;
    this.status = "idle";
    this.clearingRows = [];
    this.piecesPlaced = 0;
    this.lastRotated = false;
    this.refillQueue();
  }

  start() {
    this.reset();
    this.status = "playing";
    this.spawnPiece();
  }

  // ── queue (7-bag) ──────────────────────────────────────────────────────────
  private refillQueue() {
    while (this.queue.length < 7) {
      if (this.bag.length === 0) {
        this.bag = [...ALL_PIECES];
        // Fisher–Yates with seeded RNG
        for (let i = this.bag.length - 1; i > 0; i--) {
          const j = Math.floor(this.rand() * (i + 1));
          [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
        }
      }
      const next = this.bag.pop();
      if (next) this.queue.push(next);
    }
  }

  peekQueue(n = 5): TetrominoType[] {
    this.refillQueue();
    return this.queue.slice(0, n);
  }

  // ── collision ──────────────────────────────────────────────────────────────
  collides(
    type: TetrominoType,
    rotation: number,
    px: number,
    py: number,
    board: Cell[][] = this.board
  ): boolean {
    const shape = SHAPES[type][rotation];
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (!shape[y][x]) continue;
        const bx = px + x;
        const by = py + y;
        if (bx < 0 || bx >= COLS || by >= TOTAL_ROWS) return true;
        if (by < 0) continue;
        if (board[by][bx]) return true;
      }
    }
    return false;
  }

  private spawnPiece(): boolean {
    this.refillQueue();
    const type = this.queue.shift()!;
    this.refillQueue();
    // Spawn centered: O in middle, others offset so bounding box centers.
    const shape = SHAPES[type][0];
    const w = shape[0].length;
    const x = Math.floor((COLS - w) / 2);
    const y = 0;
    this.active = { type, rotation: 0, x, y };
    this.canHold = this.canHold; // unchanged
    this.lastRotated = false;
    if (this.collides(type, 0, x, y)) {
      this.status = "over";
      return false;
    }
    return true;
  }

  ghostY(): number | null {
    if (!this.active) return null;
    let y = this.active.y;
    while (!this.collides(this.active.type, this.active.rotation, this.active.x, y + 1)) {
      y++;
      if (y > TOTAL_ROWS) break;
    }
    return y;
  }

  // ── movements ──────────────────────────────────────────────────────────────
  moveLeft(): boolean {
    if (!this.active || this.status !== "playing") return false;
    const a = this.active;
    if (!this.collides(a.type, a.rotation, a.x - 1, a.y)) {
      a.x -= 1;
      this.lastRotated = false;
      return true;
    }
    return false;
  }

  moveRight(): boolean {
    if (!this.active || this.status !== "playing") return false;
    const a = this.active;
    if (!this.collides(a.type, a.rotation, a.x + 1, a.y)) {
      a.x += 1;
      this.lastRotated = false;
      return true;
    }
    return false;
  }

  /** Returns true if piece moved down, false if blocked (caller may lock). */
  softDropStep(): boolean {
    if (!this.active || this.status !== "playing") return false;
    const a = this.active;
    if (!this.collides(a.type, a.rotation, a.x, a.y + 1)) {
      a.y += 1;
      this.score += 1;
      this.lastRotated = false;
      return true;
    }
    return false;
  }

  rotateCW(): boolean {
    return this.rotate(1);
  }

  rotateCCW(): boolean {
    return this.rotate(-1);
  }

  private rotate(dir: 1 | -1): boolean {
    if (!this.active || this.status !== "playing") return false;
    const a = this.active;
    const from = a.rotation;
    const to = (from + dir + 4) % 4;
    for (const [dx, dy] of getKicks(a.type, from, to)) {
      if (!this.collides(a.type, to, a.x + dx, a.y + dy)) {
        a.rotation = to;
        a.x += dx;
        a.y += dy;
        this.lastRotated = true;
        return true;
      }
    }
    return false;
  }

  /** 3-corner T-spin detection (full only, MVP). Call at lock time. */
  isTspin(): boolean {
    const a = this.active;
    if (!a || a.type !== "T" || !this.lastRotated) return false;
    // T center in board coords (3x3 box → center +1,+1)
    const cx = a.x + 1;
    const cy = a.y + 1;
    const corners: [number, number][] = [
      [cx - 1, cy - 1],
      [cx + 1, cy - 1],
      [cx - 1, cy + 1],
      [cx + 1, cy + 1],
    ];
    let filled = 0;
    for (const [bx, by] of corners) {
      if (bx < 0 || bx >= COLS || by < 0 || by >= TOTAL_ROWS) {
        filled++;
        continue;
      }
      if (this.board[by]?.[bx]) filled++;
    }
    return filled >= 3;
  }

  holdPiece(): boolean {
    if (!this.active || this.status !== "playing" || !this.canHold) return false;
    const cur = this.active.type;
    this.lastRotated = false;
    if (this.hold === null) {
      this.hold = cur;
      this.spawnAfterHold();
    } else {
      const tmp = this.hold;
      this.hold = cur;
      // spawn held piece directly
      const shape = SHAPES[tmp][0];
      const w = shape[0].length;
      const x = Math.floor((COLS - w) / 2);
      this.active = { type: tmp, rotation: 0, x, y: 0 };
      if (this.collides(tmp, 0, x, 0)) {
        this.status = "over";
        return false;
      }
    }
    this.canHold = false;
    return true;
  }

  private spawnAfterHold() {
    this.refillQueue();
    const type = this.queue.shift()!;
    this.refillQueue();
    const shape = SHAPES[type][0];
    const x = Math.floor((COLS - shape[0].length) / 2);
    this.active = { type, rotation: 0, x, y: 0 };
    this.lastRotated = false;
    if (this.collides(type, 0, x, 0)) this.status = "over";
  }

  hardDrop(): { distance: number; result: LockResult | null } {
    if (!this.active || this.status !== "playing")
      return { distance: 0, result: null };
    let dist = 0;
    while (
      !this.collides(
        this.active.type,
        this.active.rotation,
        this.active.x,
        this.active.y + 1
      )
    ) {
      this.active.y += 1;
      dist++;
    }
    this.score += dist * 2;
    const result = this.lockPiece();
    return { distance: dist, result };
  }

  /** Lock active piece into board, clear lines, score, spawn next. */
  lockPiece(): LockResult {
    const empty: LockResult = {
      locked: false,
      clearedRows: [],
      gained: 0,
      lines: 0,
      isTetris: false,
      tspin: false,
      combo: this.combo,
      b2b: this.b2b,
      b2bBefore: this.b2b,
      level: this.level,
      gameOver: false,
      toppedOut: false,
    };
    if (!this.active || this.status !== "playing") return empty;
    const tspin = this.isTspin();
    const b2bBefore = this.b2b;
    const a = this.active;
    const shape = SHAPES[a.type][a.rotation];

    // Block-out: any cell locks fully above visible field → top out.
    let allAbove = true;
    for (let y = 0; y < shape.length; y++)
      for (let x = 0; x < shape[y].length; x++) {
        if (!shape[y][x]) continue;
        if (a.y + y >= HIDDEN_ROWS) allAbove = false;
      }

    for (let y = 0; y < shape.length; y++)
      for (let x = 0; x < shape[y].length; x++) {
        if (!shape[y][x]) continue;
        const by = a.y + y;
        const bx = a.x + x;
        if (by >= 0 && by < TOTAL_ROWS && bx >= 0 && bx < COLS)
          this.board[by][bx] = a.type;
      }
    this.piecesPlaced++;
    this.canHold = true;

    const cleared = this.findFullRows();
    let gained = 0;
    const n = cleared.length;
    const isTetris = n === 4;
    const isClear = n > 0;

    if (isClear) {
      const base =
        n === 1
          ? SCORE_TABLE.single
          : n === 2
            ? SCORE_TABLE.double
            : n === 3
              ? SCORE_TABLE.triple
              : SCORE_TABLE.tetris;
      const difficult = n === 4 || (tspin && n > 0);
      let mult = 1;
      if (difficult && b2bBefore) mult = 1.5;
      gained = Math.floor(base * this.level * mult);
      // T-spin line bonus (readable, matches attack power)
      if (tspin && n > 0) gained += 100 * n * this.level;
      this.combo += 1;
      if (this.combo > 0) gained += 50 * this.combo * this.level;
      if (difficult) this.b2b = true;
      else if (n > 0) this.b2b = false;
      // remove rows
      for (const r of [...cleared].sort((p, q) => q - p)) {
        this.board.splice(r, 1);
        this.board.unshift(Array<Cell>(COLS).fill(0));
      }
      this.lines += n;
      this.score += gained;
      const newLevel = Math.floor(this.lines / 10) + 1;
      this.level = newLevel;
      this.clearingRows = cleared;
    } else {
      this.combo = -1;
      this.clearingRows = [];
    }

    if (allAbove && isClear === false) {
      // edge: locked entirely in hidden rows without clear — still alive unless spawn fails
    }

    // spawn next; detect game over / top-out (lock-out)
    this.active = null;
    const ok = this.spawnPiece();
    const toppedOut = allAbove;
    const gameOver = !ok;
    if (gameOver) this.status = "over";

    return {
      locked: true,
      clearedRows: cleared,
      gained,
      lines: n,
      isTetris,
      tspin,
      combo: this.combo,
      b2b: this.b2b,
      b2bBefore,
      level: this.level,
      gameOver,
      toppedOut,
    };
  }

  /**
   * Insert garbage rows at bottom, pushing stack up.
   * Receiver chooses hole columns (anti-cheat). Active piece shifts up with stack.
   * Returns { gameOver } — true if stack pushed out the top and active collides.
   */
  addGarbageRows(holes: number[]): { inserted: number; gameOver: boolean } {
    if (this.status !== "playing" || holes.length === 0)
      return { inserted: 0, gameOver: false };
    const n = holes.length;
    // overflow = non-empty cells pushed out the top
    let overflow = false;
    for (let i = 0; i < n; i++) {
      const row = this.board[i];
      if (row && row.some((c) => c !== 0)) overflow = true;
    }
    // shift up
    this.board.splice(0, n);
    for (const hole of holes) {
      const row: Cell[] = Array<Cell>(COLS).fill("G");
      if (hole >= 0 && hole < COLS) row[hole] = 0;
      this.board.push(row);
    }
    // active piece rides up with the stack
    if (this.active) {
      this.active.y = Math.max(0, this.active.y - n);
      this.lastRotated = false;
      if (this.collides(this.active.type, this.active.rotation, this.active.x, this.active.y)) {
        // try nudging up; if still colliding → top out
        let free = false;
        for (let up = 1; up <= n + 2; up++) {
          const y = this.active.y - up;
          if (y < 0) break;
          if (!this.collides(this.active.type, this.active.rotation, this.active.x, y)) {
            this.active.y = y;
            free = true;
            break;
          }
        }
        if (!free) {
          this.status = "over";
          return { inserted: n, gameOver: true };
        }
      }
    }
    // hard top-out: overflow pushed blocks out AND spawn area blocked
    if (overflow && this.active && this.active.y <= 1 && this.collides(this.active.type, this.active.rotation, this.active.x, this.active.y)) {
      this.status = "over";
      return { inserted: n, gameOver: true };
    }
    this.clearingRows = [];
    return { inserted: n, gameOver: false };
  }

  private findFullRows(): number[] {
    const out: number[] = [];
    for (let y = 0; y < TOTAL_ROWS; y++) {
      let full = true;
      for (let x = 0; x < COLS; x++) {
        if (!this.board[y][x]) {
          full = false;
          break;
        }
      }
      if (full) out.push(y);
    }
    return out;
  }

  getIntervalMs(): number {
    return dropIntervalMs(this.level);
  }

  snapshot(): EngineSnapshot {
    return {
      board: this.board.map((r) => [...r]),
      active: this.active ? { ...this.active } : null,
      ghostY: this.ghostY(),
      hold: this.hold,
      canHold: this.canHold,
      queue: [...this.queue],
      score: this.score,
      lines: this.lines,
      level: this.level,
      combo: this.combo,
      b2b: this.b2b,
      status: this.status,
      clearingRows: [...this.clearingRows],
      piecesPlaced: this.piecesPlaced,
    };
  }

  /** Compact board encoding for network sync (20 visible rows → strings). */
  encodeBoard(): string[] {
    const map: Record<string, string> = {
      "0": "0",
      I: "1",
      O: "2",
      T: "3",
      S: "4",
      Z: "5",
      J: "6",
      L: "7",
      G: "8",
    };
    return this.board.slice(HIDDEN_ROWS).map((row) =>
      row.map((c) => map[String(c)] ?? "0").join("")
    );
  }

  static decodeBoard(rows: string[]): Cell[][] {
    const rev: Record<string, Cell> = {
      "0": 0,
      "1": "I",
      "2": "O",
      "3": "T",
      "4": "S",
      "5": "Z",
      "6": "J",
      "7": "L",
      "8": "G",
    };
    const out: Cell[][] = [];
    // hidden rows empty
    for (let i = 0; i < HIDDEN_ROWS; i++) out.push(Array<Cell>(COLS).fill(0));
    for (const r of rows) {
      const row: Cell[] = [];
      for (const ch of r) row.push(rev[ch] ?? 0);
      while (row.length < COLS) row.push(0);
      out.push(row.slice(0, COLS));
    }
    return out;
  }
}
