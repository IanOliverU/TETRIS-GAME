"use client";
import { useMemo, useState } from "react";
import BoardCanvas from "./BoardCanvas";
import { TetrisEngine } from "@/lib/tetris/engine";

export interface SpectateCandidate {
  id: string;
  label: string;
  score: number;
  lines: number;
  level: number;
  pending: number;
  board?: string[];
}

function CandidateBoard({ rows, width }: { rows?: string[]; width: number }) {
  const board = useMemo(
    () => (rows ? TetrisEngine.decodeBoard(rows) : null),
    [rows]
  );
  if (!board) return <div className="py-4 text-center text-xs text-slate-600">no signal</div>;
  return <BoardCanvas board={board} active={null} ghostY={null} width={width} showGrid={false} />;
}

// Spectator controls: GRID (all survivors) ↔ POV (one player, switchable).
export default function SpectatorPanel({
  candidates,
  focusId,
  onFocus,
  survivors,
  title = "SPECTATING",
}: {
  candidates: SpectateCandidate[];
  focusId: string | null;
  onFocus: (id: string) => void;
  survivors: number;
  title?: string;
}) {
  const [mode, setMode] = useState<"GRID" | "POV">("POV");
  const focus =
    candidates.find((c) => c.id === focusId) ?? candidates[0] ?? null;

  const step = (dir: 1 | -1) => {
    if (!focus || candidates.length < 2) return;
    const i = candidates.findIndex((c) => c.id === focus.id);
    onFocus(candidates[(i + dir + candidates.length) % candidates.length].id);
  };

  if (candidates.length === 0) {
    return (
      <section className="panel panel-sharp mx-auto mt-4 max-w-md p-4 text-center text-sm text-slate-400">
        {title} — no survivors left.
      </section>
    );
  }

  return (
    <section className="panel panel-sharp mx-auto mt-4 max-w-2xl p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="text-xs font-bold tracking-[0.3em] text-slate-300">
          {title} · SURVIVORS {survivors}
        </div>
        <div className="flex gap-1 text-xs font-bold">
          <button
            onClick={() => setMode("GRID")}
            className={`border px-3 py-1 ${mode === "GRID" ? "border-cyan-300 bg-cyan-400/20" : "border-slate-600"}`}
          >
            GRID
          </button>
          <button
            onClick={() => setMode("POV")}
            className={`border px-3 py-1 ${mode === "POV" ? "border-cyan-300 bg-cyan-400/20" : "border-slate-600"}`}
          >
            POV
          </button>
        </div>
      </div>

      {mode === "GRID" ? (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {candidates.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                onFocus(c.id);
                setMode("POV");
              }}
              className={`border p-2 text-left text-xs ${c.id === focus?.id ? "border-cyan-300 bg-cyan-400/10" : "border-white/10"}`}
            >
              <div className="flex justify-between font-bold">
                <span className="truncate">● {c.label}</span>
                {c.pending > 0 && <span className="text-red-400">+{c.pending}</span>}
              </div>
              <div className="font-mono2 text-[11px] text-slate-400">
                {c.score.toLocaleString()} · L{c.level}
              </div>
              <div className="mt-1 flex justify-center">
                <CandidateBoard rows={c.board} width={120} />
              </div>
              <div className="mt-1 text-center text-[10px] text-cyan-300">WATCH ▶</div>
            </button>
          ))}
        </div>
      ) : focus ? (
        <div>
          <div className="mt-2 flex items-center justify-between gap-2 px-1 text-sm">
            <button onClick={() => step(-1)} className="border border-slate-600 px-3 py-1 text-xs">
              ◀ PREV
            </button>
            <span className="font-bold">
              ● {focus.label}{" "}
              <span className="font-mono2 text-xs text-slate-400">
                {focus.score.toLocaleString()} · L{focus.level} · {focus.lines}ln
                {focus.pending > 0 && <span className="text-red-400"> · ☠+{focus.pending}</span>}
              </span>
            </span>
            <button onClick={() => step(1)} className="border border-slate-600 px-3 py-1 text-xs">
              NEXT ▶
            </button>
          </div>
          <div className="mt-2 flex justify-center">
            <CandidateBoard rows={focus.board} width={220} />
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-1">
            {candidates.map((c) => (
              <button
                key={c.id}
                onClick={() => onFocus(c.id)}
                className={`border px-2 py-1 text-[11px] ${c.id === focus.id ? "border-cyan-300 bg-cyan-400/20" : "border-slate-600"}`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
