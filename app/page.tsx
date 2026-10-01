"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { generateRoomCode, normalizeRoomCode, isValidRoomCode } from "@/lib/room";
import NameModal from "@/components/NameModal";

export default function Page() {
  const { session, setName } = useSession();
  const [joinCode, setJoinCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  if (!session) {
    return <NameModal onDone={setName} />;
  }

  const create = () => {
    const code = generateRoomCode(6);
    router.push(`/game/${code}`);
  };

  const join = () => {
    const c = normalizeRoomCode(joinCode);
    if (!isValidRoomCode(c)) {
      setErr("Enter a valid room code (e.g. A7K92X).");
      return;
    }
    router.push(`/game/${c}`);
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-48px)] w-full max-w-3xl flex-col items-center justify-center px-4 py-10">
      <div className="text-xs font-bold tracking-[0.4em] text-cyan-300/80">PRIVATE MULTIPLAYER ROOMS</div>
      <h1 className="text-glow mt-2 text-center text-5xl font-bold tracking-wide">TETRIS BATTLE</h1>
      <p className="mt-3 text-center text-base text-slate-400">
        Welcome, <span className="font-bold text-slate-100">{session.name}</span>. Create a room or join your friends.
      </p>

      <div className="panel panel-sharp mt-8 grid w-full gap-3 p-6">
        <button onClick={create} className="btn-arcade px-6 py-4 text-xl font-bold tracking-widest">
          CREATE GAME
        </button>
        <div className="flex gap-2">
          <input
            value={joinCode}
            onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setErr(null); }}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") join(); }}
            onKeyUp={(e) => e.stopPropagation()}
            placeholder="ROOM CODE (A7K92X)"
            maxLength={8}
            className="flex-1 border border-slate-600 bg-black/60 px-4 py-3 text-center font-mono2 text-lg tracking-[0.2em] outline-none placeholder:text-slate-600 focus:border-cyan-400"
          />
          <button onClick={join} className="btn-arcade px-6 font-bold tracking-widest">
            JOIN
          </button>
        </div>
        {err && <p className="text-center text-sm text-red-400">{err}</p>}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="border border-white/10 p-3 text-slate-300">
            <span className="font-bold text-slate-100">Survival</span>
            <br />One life. Last player standing wins.
          </div>
          <div className="border border-white/10 p-3 text-slate-300">
            <span className="font-bold text-slate-100">Knockout</span>
            <br />Three lives. Send garbage and earn KOs.
          </div>
        </div>
      </div>

      <div className="mt-6 w-full text-sm leading-relaxed text-slate-500">
        Controls: ← → move · ↓ soft · Space hard · ↑/X rotate · Z counter · C/Shift hold · T target (battle).
        No accounts. Music: YouTube plays in a visible mini-player; Spotify links open externally.
      </div>
    </main>
  );
}
