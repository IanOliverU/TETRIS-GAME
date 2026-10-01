// Battle attack tables (finalized ruleset). Pure logic, no React.
// Base + B2B(+1) + combo bonus, capped at 8 per attack.

export type ClearKind =
  | { lines: 0; tspin: false }
  | { lines: 0; tspin: true }
  | { lines: 1; tspin: boolean; mini?: boolean }
  | { lines: 2; tspin: boolean; mini?: boolean }
  | { lines: 3; tspin: boolean }
  | { lines: 4; tspin: boolean };

export function baseAttack(kind: ClearKind): number {
  if (!kind.tspin) {
    switch (kind.lines) {
      case 0: return 0;
      case 1: return 1;
      case 2: return 1;
      case 3: return 2;
      case 4: return 4;
    }
  }
  // T-spins (full only in MVP)
  if (kind.lines === 0) return 0;
  if (kind.lines === 1) return 2;
  if (kind.lines === 2) return 4;
  return 6; // T-spin triple
}

export function isDifficult(kind: ClearKind): boolean {
  return kind.lines === 4 || (kind.tspin && kind.lines > 0);
}

export function comboBonus(combo: number): number {
  if (combo <= 0) return 0;
  if (combo <= 2) return 1;
  if (combo <= 4) return 2;
  return 3;
}

export interface AttackCalc {
  total: number;
  base: number;
  b2bBonus: number;
  comboBonus: number;
}

export function calcAttack(
  kind: ClearKind,
  combo: number,
  b2bActive: boolean
): AttackCalc {
  const base = baseAttack(kind);
  const difficult = isDifficult(kind);
  const b2bBonus = difficult && b2bActive ? 1 : 0;
  const cb = kind.lines > 0 ? comboBonus(combo) : 0;
  return { total: Math.min(8, base + b2bBonus + cb), base, b2bBonus, comboBonus: cb };
}

// ── garbage holes ────────────────────────────────────────────────────────────
// One hole per row. Hole persists per attack batch, 70% shift ±1-2 for next batch.

export function nextHoleColumn(
  prev: number | null,
  rand: () => number = Math.random
): number {
  if (prev === null || prev === undefined) return Math.floor(rand() * 10);
  if (rand() < 0.3) return prev;
  const shift = rand() < 0.5 ? -1 - Math.floor(rand() * 2) : 1 + Math.floor(rand() * 2);
  return (((prev + shift) % 10) + 10) % 10;
}

export function makeGarbageRow(hole: number): (0 | "G")[] {
  return Array.from({ length: 10 }, (_, i) => (i === hole ? 0 : "G")) as (0 | "G")[];
}

export function acceptsAttack(playerId: string, attack: { fromId: string; toId: string; amount: number }): boolean {
  return attack.toId === playerId && attack.fromId !== playerId &&
    Number.isSafeInteger(attack.amount) && attack.amount > 0;
}

/** Consume only eligible rows, even when delayed batches arrive out of order. */
export function takeReadyGarbage<T extends { amount: number; receivedAt: number }>(
  pending: T[], now: number, grace: number, limit = 5
): { pending: T[]; consumed: T[]; amount: number } {
  const remaining: T[] = [];
  const consumed: T[] = [];
  let amount = 0;
  for (const item of pending) {
    const take = now - item.receivedAt >= grace ? Math.min(item.amount, limit - amount) : 0;
    if (take > 0) consumed.push({ ...item, amount: take });
    if (item.amount > take) remaining.push({ ...item, amount: item.amount - take });
    amount += take;
  }
  return { pending: remaining, consumed, amount };
}

/** A clear first cancels incoming rows, including rows delayed by the cap. */
export function cancelQueuedGarbage<T extends { amount: number; receivedAt: number }>(
  attack: number,
  pending: T[],
  deferred: { item: T; at: number }[]
): { pending: T[]; deferred: { item: T; at: number }[]; remaining: number; cancelled: number } {
  let remaining = attack;
  let cancelled = 0;
  const nextPending: T[] = [];
  const nextDeferred: { item: T; at: number }[] = [];
  const queue = [
    ...pending.map((item) => ({ item, at: item.receivedAt, delayed: false })),
    ...deferred.map(({ item, at }) => ({ item, at, delayed: true })),
  ].sort((a, b) => a.item.receivedAt - b.item.receivedAt);
  for (const entry of queue) {
    const used = Math.min(remaining, entry.item.amount);
    remaining -= used;
    cancelled += used;
    const amount = entry.item.amount - used;
    if (amount > 0) {
      const item = { ...entry.item, amount };
      if (entry.delayed) nextDeferred.push({ item, at: entry.at });
      else nextPending.push(item);
    }
  }
  return { pending: nextPending, deferred: nextDeferred, remaining, cancelled };
}
