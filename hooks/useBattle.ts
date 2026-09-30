"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TetrisEngine, LockResult } from "@/lib/tetris/engine";
import { calcAttack, nextHoleColumn, type ClearKind } from "@/lib/tetris/garbage";
import type { NetEvent, PresenceState } from "@/lib/net/protocol";

export type TargetMode = "RANDOM" | "ATTACKERS" | "TARGETED";

export interface PendingItem {
  attackId: string;
  fromId: string;
  fromName: string;
  amount: number;
  receivedAt: number;
}

interface UseBattleOpts {
  engine: TetrisEngine;
  refresh: () => void;
  session: { playerId: string; name: string } | null;
  peers: PresenceState[];
  peerAlive: (id: string) => boolean;
  garbageMode: "chill" | "normal" | "spicy";
  broadcast: (e: NetEvent) => void;
  pushToast: (t: string) => void;
  displayNameOf: (id: string) => string;
  onGameOver: (info: { lastAttackerId?: string }) => void;
  enabled: boolean;
}

function graceMs(mode: "chill" | "normal" | "spicy"): number {
  return mode === "chill" ? 1200 : mode === "spicy" ? 800 : 1000;
}

function scaleAttack(total: number, lines: number, mode: "chill" | "normal" | "spicy"): number {
  if (mode === "chill") return Math.min(6, Math.floor(total * 0.5));
  if (mode === "spicy") return Math.min(8, total + (lines >= 2 ? 1 : 0));
  return total;
}

export function useBattle(opts: UseBattleOpts) {
  const { engine, refresh, session, peers, peerAlive, garbageMode, broadcast, pushToast, displayNameOf, onGameOver, enabled } = opts;
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [targetMode, setTargetMode] = useState<TargetMode>("RANDOM");
  const [targetId, setTargetId] = useState<string | null>(null);
  const pendingRef = useRef<PendingItem[]>([]);
  const recentIncoming = useRef<{ amount: number; at: number }[]>([]);
  const recentAttackers = useRef<{ fromId: string; fromName: string; at: number }[]>([]);
  const lastTargets = useRef<string[]>([]);
  const holePrev = useRef<number | null>(null);
  const outbox = useRef<{ toId: string; amount: number }[]>([]);
  const lastAttacker = useRef<string | undefined>(undefined);
  const lastInsert = useRef(0);
  const deferred = useRef<{ item: PendingItem; at: number }[]>([]);

  const pendingTotal = useMemo(() => pending.reduce((s, p) => s + p.amount, 0), [pending]);

  const setPendingBoth = useCallback((list: PendingItem[]) => {
    pendingRef.current = list;
    setPending(list);
  }, []);

  const aliveIds = useCallback((): string[] => {
    if (!session) return [];
    const ids = new Set<string>();
    for (const p of peers) {
      if (p.playerId === session.playerId) continue;
      if (!peerAlive(p.playerId)) continue;
      ids.add(p.playerId);
    }
    return [...ids];
  }, [peers, peerAlive, session]);

  // ── outgoing batch flush (250ms) ───────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    const iv = setInterval(() => {
      if (outbox.current.length === 0 || !session) return;
      const batch = outbox.current.splice(0, outbox.current.length);
      // combine per target
      const byTarget = new Map<string, number>();
      for (const o of batch) {
        if (!peerAlive(o.toId)) continue; // dead → drop (sender re-routes next time)
        byTarget.set(o.toId, (byTarget.get(o.toId) ?? 0) + o.amount);
      }
      for (const [toId, amount] of byTarget) {
        if (amount <= 0) continue;
        broadcast({
          type: "attack",
          attackId: `${session.playerId}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
          fromId: session.playerId,
          fromName: session.name,
          toId,
          amount,
        });
      }
    }, 250);
    return () => clearInterval(iv);
  }, [enabled, broadcast, peerAlive, session]);

  // ── target resolution ──────────────────────────────────────────────────────
  const resolveTargets = useCallback(
    (total: number): { toId: string; amount: number }[] => {
      const alive = aliveIds();
      if (alive.length === 0 || total <= 0) return [];
      const pickRandom = (exclude?: string): string => {
        const pool = exclude ? alive.filter((id) => id !== exclude) : alive;
        const list = pool.length ? pool : alive;
        // avoid same target 3x in a row
        const last3 = lastTargets.current.slice(-2);
        let choice = list[Math.floor(Math.random() * list.length)];
        if (last3.length === 2 && last3[0] === last3[1] && last3[0] === choice && list.length > 1) {
          const alt = list.filter((id) => id !== choice);
          choice = alt[Math.floor(Math.random() * alt.length)];
        }
        lastTargets.current.push(choice);
        if (lastTargets.current.length > 8) lastTargets.current.shift();
        return choice;
      };
      if (targetMode === "TARGETED" && targetId && alive.includes(targetId)) {
        lastTargets.current.push(targetId);
        return [{ toId: targetId, amount: total }];
      }
      if (targetMode === "ATTACKERS") {
        const now = Date.now();
        const recent = recentAttackers.current.filter((a) => now - a.at < 5000 && alive.includes(a.fromId));
        if (recent.length > 0) {
          const uniq = Array.from(new Map(recent.map((r) => [r.fromId, r])).keys());
          const base = Math.floor(total / uniq.length);
          let rem = total % uniq.length;
          // most recent attacker first for remainder
          const ordered = [...uniq].sort((a, b) => {
            const ta = Math.max(...recent.filter((r) => r.fromId === a).map((r) => r.at));
            const tb = Math.max(...recent.filter((r) => r.fromId === b).map((r) => r.at));
            return tb - ta;
          });
          return ordered.map((id) => {
            const extra = rem > 0 ? 1 : 0;
            if (rem > 0) rem--;
            return { toId: id, amount: base + extra };
          }).filter((s) => s.amount > 0);
        }
        // fallback RANDOM
      }
      return [{ toId: pickRandom(), amount: total }];
    },
    [aliveIds, targetMode, targetId]
  );

  // ── lock → cancel then attack ──────────────────────────────────────────────
  const handleLock = useCallback(
    (res: LockResult) => {
      if (!session || !enabled) return;
      const kind: ClearKind =
        res.lines === 0
          ? { lines: 0, tspin: res.tspin }
          : res.lines === 1
            ? { lines: 1, tspin: res.tspin }
            : res.lines === 2
              ? { lines: 2, tspin: res.tspin }
              : res.lines === 3
                ? { lines: 3, tspin: res.tspin }
                : { lines: 4, tspin: res.tspin };
      const calc = calcAttack(kind, res.combo, res.b2bBefore);
      let total = scaleAttack(calc.total, res.lines, garbageMode);
      if (total <= 0) return;

      // 1) cancel own pending first (oldest first), 1:1
      let remaining = total;
      let cancelled = 0;
      if (pendingRef.current.length > 0) {
        const list = [...pendingRef.current];
        while (remaining > 0 && list.length > 0) {
          const head = list[0];
          if (head.amount <= remaining) {
            remaining -= head.amount;
            cancelled += head.amount;
            list.shift();
          } else {
            head.amount -= remaining;
            cancelled += remaining;
            remaining = 0;
          }
        }
        setPendingBoth(list);
        if (cancelled > 0) {
          pushToast(cancelled >= total ? "BLOCKED!" : `-${cancelled} CANCELLED`);
        }
      }
      if (remaining <= 0) return; // fully defended

      // 2) route remainder
      const targets = resolveTargets(remaining);
      // re-route check: if TARGETED died mid-flight, resolveTargets already fell back
      for (const t of targets) outbox.current.push(t);
      const label = targets.map((t) => `${displayNameOf(t.toId)} +${t.amount}`).join(", ");
      pushToast(`+${remaining} GARBAGE → ${label}`);
    },
    [session, enabled, garbageMode, broadcast, resolveTargets, displayNameOf, pushToast, setPendingBoth]
  );

  // ── incoming attack → pending with cap + heat dampening ────────────────────
  const handleIncoming = useCallback(
    (evt: Extract<NetEvent, { type: "attack" }>) => {
      if (!session || evt.toId !== session.playerId || !enabled) return;
      if (engine.status !== "playing") return;
      const now = Date.now();
      // heat: >6 received in last 2s → -1 (min 0)
      const recentSum = recentIncoming.current.filter((r) => now - r.at < 2000).reduce((s, r) => s + r.amount, 0);
      let amount = evt.amount;
      if (recentSum > 6 && amount > 0) amount = Math.max(0, amount - 1);
      if (amount <= 0) return;
      recentIncoming.current.push({ amount, at: now });
      recentIncoming.current = recentIncoming.current.filter((r) => now - r.at < 5000);
      recentAttackers.current.push({ fromId: evt.fromId, fromName: evt.fromName, at: now });
      recentAttackers.current = recentAttackers.current.slice(-12);
      lastAttacker.current = evt.fromId;

      const cur = pendingRef.current.reduce((s, p) => s + p.amount, 0);
      const CAP = 8;
      if (cur + amount > CAP) {
        const accept = Math.max(0, CAP - cur);
        const excess = amount - accept;
        if (accept > 0) {
          setPendingBoth([...pendingRef.current, { attackId: evt.attackId, fromId: evt.fromId, fromName: evt.fromName, amount: accept, receivedAt: now }]);
        }
        if (excess > 0) {
          // defer overflow 1500ms (still threatens, but survivable)
          deferred.current.push({ item: { attackId: evt.attackId + ":d", fromId: evt.fromId, fromName: evt.fromName, amount: excess, receivedAt: now + 1500 }, at: now + 1500 });
          pushToast(`INCOMING +${accept} from ${evt.fromName} (+${excess} delayed)`);
        } else {
          pushToast(`INCOMING +${accept} from ${evt.fromName}`);
        }
      } else {
        setPendingBoth([...pendingRef.current, { attackId: evt.attackId, fromId: evt.fromId, fromName: evt.fromName, amount, receivedAt: now }]);
        pushToast(`INCOMING +${amount} from ${evt.fromName}`);
      }
    },
    [session, enabled, engine, setPendingBoth, pushToast]
  );

  // ── insertion tick: grace then ≤5 per 500ms, 1 hole per row ────────────────
  useEffect(() => {
    if (!enabled) return;
    const iv = setInterval(() => {
      const now = Date.now();
      // re-add deferred overflow
      const due0 = deferred.current.filter((d) => d.at <= now);
      if (due0.length) {
        deferred.current = deferred.current.filter((d) => d.at > now);
        setPendingBoth([...pendingRef.current, ...due0.map((d) => ({ ...d.item, receivedAt: now }))]);
      }
      if (pendingRef.current.length === 0 || engine.status !== "playing") return;
      if (now - lastInsert.current < 500) return;
      const g = graceMs(garbageMode);
      const dueIdx: number[] = [];
      pendingRef.current.forEach((p, i) => {
        if (now - p.receivedAt >= g) dueIdx.push(i);
      });
      if (dueIdx.length === 0) return;
      let toInsert = 0;
      for (const i of dueIdx) toInsert += pendingRef.current[i].amount;
      toInsert = Math.min(5, toInsert);
      // consume from oldest
      const list = [...pendingRef.current];
      let need = toInsert;
      while (need > 0 && list.length > 0) {
        const head = list[0];
        // only consume due items (receivedAt+grace passed)
        if (now - head.receivedAt < g) break;
        if (head.amount <= need) {
          need -= head.amount;
          list.shift();
        } else {
          head.amount -= need;
          need = 0;
        }
      }
      // holes: chain per row
      const holes: number[] = [];
      for (let i = 0; i < toInsert; i++) {
        holePrev.current = nextHoleColumn(holePrev.current);
        holes.push(holePrev.current);
      }
      lastInsert.current = now;
      const { gameOver } = engine.addGarbageRows(holes);
      setPendingBoth(list);
      refresh();
      if (gameOver) onGameOver({ lastAttackerId: lastAttacker.current });
    }, 120);
    return () => clearInterval(iv);
  }, [enabled, engine, garbageMode, refresh, setPendingBoth, onGameOver]);

  const reset = useCallback(() => {
    setPendingBoth([]);
    pendingRef.current = [];
    recentIncoming.current = [];
    recentAttackers.current = [];
    lastTargets.current = [];
    holePrev.current = null;
    outbox.current = [];
    deferred.current = [];
    lastAttacker.current = undefined;
  }, [setPendingBoth]);

  const grouped = useMemo(() => {
    const m = new Map<string, { name: string; amount: number }>();
    for (const p of pending) {
      const e = m.get(p.fromId) ?? { name: p.fromName, amount: 0 };
      e.amount += p.amount;
      m.set(p.fromId, e);
    }
    return Array.from(m.values());
  }, [pending]);

  const cycleMode = useCallback(() => {
    setTargetMode((m) => (m === "RANDOM" ? "ATTACKERS" : m === "ATTACKERS" ? "TARGETED" : "RANDOM"));
  }, []);

  const cycleTarget = useCallback(
    (dir: 1 | -1) => {
      const alive = aliveIds();
      if (alive.length === 0) return;
      // order by display name for stable cycling
      const ordered = [...alive].sort((a, b) => displayNameOf(a).localeCompare(displayNameOf(b)));
      if (!targetId || !ordered.includes(targetId)) {
        setTargetId(ordered[0]);
        return;
      }
      const i = ordered.indexOf(targetId);
      setTargetId(ordered[(i + dir + ordered.length) % ordered.length]);
    },
    [aliveIds, targetId, displayNameOf]
  );

  // keep TARGETED valid
  useEffect(() => {
    if (targetMode === "TARGETED" && targetId && !aliveIds().includes(targetId)) {
      // fall back display; resolution falls back to RANDOM automatically
    }
  }, [aliveIds, targetId, targetMode]);

  return {
    pending, pendingTotal, grouped,
    targetMode, setTargetMode, cycleMode, targetId, setTargetId, cycleTarget,
    handleLock, handleIncoming, reset,
    lastAttackerId: lastAttacker.current,
  };
}
