"use client";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// ─── Session-only identity. In-memory ONLY. ───────────────────────────────────
// No localStorage / sessionStorage / cookies / IndexedDB anywhere in the app.
// Refresh or close tab → session gone → name modal appears again (by design).

export interface Session {
  playerId: string;
  name: string;
}

const SessionCtx = createContext<{
  session: Session | null;
  setName: (name: string) => void;
  clear: () => void;
}>({ session: null, setName: () => {}, clear: () => {} });

export function validateName(raw: string): string | null {
  const t = raw.trim().replace(/\s+/g, " ");
  if (!t) return "Please enter a name.";
  if (t.length > 16) return "Please use 16 characters or fewer.";
  if (!/^[A-Za-z0-9 .'\-_!?()]+$/.test(t))
    return "Letters, numbers and basic punctuation only.";
  return null;
}

export function sanitizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, 16);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);

  const setName = useCallback((name: string) => {
    const clean = sanitizeName(name);
    // crypto.randomUUID is per-page-load only; never persisted.
    const playerId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
    setSession({ playerId, name: clean });
  }, []);

  const clear = useCallback(() => setSession(null), []);

  const value = useMemo(
    () => ({ session, setName, clear }),
    [session, setName, clear]
  );
  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}

export function useSession() {
  return useContext(SessionCtx);
}

/** Display deduping inside a room: Ian, Ian #2. Internal routing uses playerId. */
export function dedupeNames(
  players: { playerId: string; name: string; joinedAt: number }[]
): Map<string, string> {
  const sorted = [...players].sort((a, b) => a.joinedAt - b.joinedAt);
  const counts = new Map<string, number>();
  const out = new Map<string, string>();
  for (const p of sorted) {
    const n = (counts.get(p.name) ?? 0) + 1;
    counts.set(p.name, n);
    out.set(p.playerId, n === 1 ? p.name : `${p.name} #${n}`);
  }
  return out;
}
