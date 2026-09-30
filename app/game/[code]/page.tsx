"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { SessionProvider, useSession, dedupeNames } from "@/lib/session";
import { normalizeRoomCode } from "@/lib/room";
import { useRoom } from "@/lib/net/useRoom";
import type { NetEvent, PlaylistTrack } from "@/lib/net/protocol";
import { TetrisEngine } from "@/lib/tetris/engine";
import { useTetris } from "@/hooks/useTetris";
import { useBattle } from "@/hooks/useBattle";
import NameModal from "@/components/NameModal";
import InviteButtons from "@/components/InviteButtons";
import Chat from "@/components/Chat";
import Playlist from "@/components/Playlist";
import MusicPlayer from "@/components/MusicPlayer";
import BoardCanvas from "@/components/BoardCanvas";
import PiecePreview from "@/components/PiecePreview";
import TouchControls from "@/components/TouchControls";

function encodeVisible(board: TetrisEngine["board"]): string[] {
  const map: Record<string, string> = { "0": "0", I: "1", O: "2", T: "3", S: "4", Z: "5", J: "6", L: "7", G: "8" };
  return board.slice(2).map((row) => row.map((c) => map[String(c)] ?? "0").join(""));
}

function Room() {
  const params = useParams();
  const rawCode = (params?.code as string) ?? "";
  const code = normalizeRoomCode(rawCode);
  const { session, setName } = useSession();
  const router = useRouter();

  const [musicOn, setMusicOn] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const [peerStatus, setPeerStatus] = useState<Record<string, { score: number; lines: number; level: number; alive: boolean; pending: number; board?: string[] }>>({});
  const [eliminations, setEliminations] = useState<Record<string, { place: number }>>({});
  const [spectateId, setSpectateId] = useState<string | null>(null);
  const toastId = useRef(0);

  const pushToast = useCallback((text: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 1800);
  }, []);

  const room = useRoom({
    code,
    playerId: session?.playerId ?? "",
    name: session?.name ?? "",
    enabled: !!session,
  });

  const { snap, started, start, action, refresh, setOnLock, engine } = useTetris(
    room.seed,
    room.phase === "playing"
  );

  const displayNames = useMemo(() => {
    const list = room.peers.map((p) => ({ playerId: p.playerId, name: p.name, joinedAt: p.joinedAt }));
    if (session && !list.some((p) => p.playerId === session.playerId))
      list.push({ playerId: session.playerId, name: session.name, joinedAt: Date.now() });
    return dedupeNames(list);
  }, [room.peers, session]);

  const displayNameOf = useCallback(
    (id: string) => displayNames.get(id) ?? peerStatus[id]?.board?.toString() ?? id.slice(0, 4),
    [displayNames, peerStatus]
  );

  const peerAlive = useCallback(
    (id: string) => {
      if (eliminations[id]) return false;
      if (id === session?.playerId) return engine.status !== "over";
      const s = peerStatus[id];
      if (s) return s.alive;
      const p = room.peers.find((x) => x.playerId === id);
      return p ? p.alive !== false : false;
    },
    [eliminations, peerStatus, room.peers, session, engine]
  );

  const computeAliveCount = useCallback(() => {
    const ids = new Set(room.peers.map((p) => p.playerId));
    if (session) ids.add(session.playerId);
    let n = 0;
    ids.forEach((id) => {
      if (eliminations[id]) return;
      if (id === session?.playerId) {
        if (engine.status !== "over") n++;
      } else if (peerStatus[id]?.alive ?? true) n++;
    });
    return n;
  }, [room.peers, eliminations, peerStatus, session, engine]);

  // ── elimination ────────────────────────────────────────────────────────────
  const eliminatedRef = useRef(false);
  const handleGameOver = useCallback(
    (info: { lastAttackerId?: string }) => {
      if (!session || eliminatedRef.current) return;
      eliminatedRef.current = true;
      // engine.status is already 'over' here, so computeAliveCount() excludes self.
      // Place = survivors remaining + 1 (first out in 15p = #15, winner = #1).
      const remaining = computeAliveCount();
      const myPlace = Math.max(1, remaining + 1);
      room.broadcast({ type: "eliminated", playerId: session.playerId, place: myPlace, lastAttackerId: info.lastAttackerId });
      setEliminations((e) => ({ ...e, [session.playerId]: { place: myPlace } }));
      pushToast(`ELIMINATED — #${myPlace}`);
    },
    [session, computeAliveCount, room, pushToast]
  );

  const battle = useBattle({
    engine,
    refresh,
    session,
    peers: room.peers,
    peerAlive,
    garbageMode: room.config.garbageMode,
    broadcast: room.broadcast,
    pushToast,
    displayNameOf: (id) => displayNames.get(id) ?? "???",
    onGameOver: handleGameOver,
    enabled: room.phase === "playing",
  });

  // lock → battle (cancel + attack). Also detect lock-out death.
  useEffect(() => {
    setOnLock((res) => {
      battle.handleLock(res);
      refresh();
      if (res.gameOver) handleGameOver({});
    });
  }, [setOnLock, battle, refresh, handleGameOver]);

  // countdown from shared startAt
  const [count, setCount] = useState<string | null>(null);
  useEffect(() => {
    if (room.phase !== "countdown" || !room.pendingStart) return;
    const iv = setInterval(() => {
      const ms = room.pendingStart!.startAt - Date.now();
      if (ms <= -600) {
        clearInterval(iv);
        setCount(null);
        room.setPhase("playing");
      } else if (ms <= 0) setCount("GO!");
      else setCount(String(Math.ceil(ms / 1000)));
    }, 100);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.phase, room.pendingStart?.startAt]);

  useEffect(() => {
    if (room.phase === "playing" && !started) {
      eliminatedRef.current = false;
      battle.reset();
      setEliminations({});
      setPeerStatus({});
      setSpectateId(null);
      start();
    }
    if (room.phase === "lobby") {
      eliminatedRef.current = false;
      battle.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.phase]);

  // status tick (2Hz) — compact, event-sized
  useEffect(() => {
    if (room.phase !== "playing" || !session) return;
    const iv = setInterval(() => {
      const alive = engine.status !== "over";
      room.broadcast({
        type: "status",
        playerId: session.playerId,
        score: snap.score,
        lines: snap.lines,
        level: snap.level,
        alive,
        pending: battle.pendingTotal,
        board: encodeVisible(snap.board),
      } as NetEvent);
      room.updatePresence({ score: snap.score, lines: snap.lines, level: snap.level, alive });
      if (!alive && !eliminatedRef.current) handleGameOver({});
    }, 500);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.phase, snap.score, snap.lines, snap.level, snap.status, battle.pendingTotal]);

  // net events
  useEffect(() => {
    const h = (e: Event) => {
      const evt = (e as CustomEvent).detail as NetEvent;
      if (evt.type === "status") {
        setPeerStatus((p) => ({
          ...p,
          [evt.playerId]: { score: evt.score, lines: evt.lines, level: evt.level, alive: evt.alive, pending: evt.pending, board: evt.board },
        }));
      } else if (evt.type === "attack") {
        battle.handleIncoming(evt);
      } else if (evt.type === "eliminated") {
        setEliminations((el) => (el[evt.playerId] ? el : { ...el, [evt.playerId]: { place: evt.place } }));
        const nm = displayNames.get(evt.playerId) ?? "Player";
        pushToast(`☠ ${nm} eliminated #${evt.place}`);
      }
    };
    window.addEventListener("tetris-net", h);
    return () => window.removeEventListener("tetris-net", h);
  }, [battle, displayNames, pushToast]);

  // host declares winner: last alive → game_end
  const aliveCount = computeAliveCount();
  useEffect(() => {
    if (!room.isHost || room.phase !== "playing") return;
    if (aliveCount === 1 || aliveCount === 0) {
      const ids = new Set(room.peers.map((p) => p.playerId));
      if (session) ids.add(session.playerId);
      const scoreOf = (id: string) =>
        id === session?.playerId ? snap.score : (peerStatus[id]?.score ?? 0);
      // winner = the one alive (or highest score if 0)
      let winner: string | null = null;
      ids.forEach((id) => {
        if (!eliminations[id]) winner = winner ?? id;
      });
      if (!winner) {
        let best = -1;
        ids.forEach((id) => {
          if (scoreOf(id) > best) { best = scoreOf(id); winner = id; }
        });
      }
      const total = ids.size;
      const placements = Array.from(ids).map((id) => ({
        playerId: id,
        // winner always #1 (covers simultaneous-death where winner also has an elim record)
        place: id === winner ? 1 : (eliminations[id]?.place ?? total),
      }));
      // fix simultaneous-death ties by score
      const t = setTimeout(() => {
        room.broadcast({ type: "game_end", winnerId: winner, placements });
        room.setPhase("results");
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [aliveCount, room, session, snap.score, peerStatus, eliminations]);

  // targeting keys T/Q/E (disabled while typing)
  useEffect(() => {
    if (room.phase !== "playing") return;
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.code === "KeyT") battle.cycleMode();
      if (e.code === "KeyQ") { battle.setTargetMode("TARGETED"); battle.cycleTarget(-1); }
      if (e.code === "KeyE") { battle.setTargetMode("TARGETED"); battle.cycleTarget(1); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [room.phase, battle]);

  if (!session) return <NameModal roomCode={code} onDone={setName} />;

  const startGame = () => {
    const order = [...room.playlist.map((t) => t.id)].sort(() => Math.random() - 0.5);
    room.broadcast({
      type: "game_start",
      startAt: Date.now() + 3500,
      seed: Math.floor(Math.random() * 2 ** 31),
      playlistOrder: order,
    });
    room.setPhase("countdown");
  };

  const addTrack = (t: PlaylistTrack) => {
    room.setPlaylist((p) => [...p, t]);
    room.broadcast({ type: "playlist_add", track: t });
  };
  const removeTrack = (id: string) => {
    room.setPlaylist((p) => p.filter((t) => t.id !== id));
    room.broadcast({ type: "playlist_remove", trackId: id, byId: session.playerId });
  };

  // ── results (survival order, score secondary) ──────────────────────────────
  if (room.phase === "results") {
    const rows = Array.from(displayNames.entries())
      .map(([id, label]) => ({
        id,
        label,
        place: room.placements.find((p) => p.playerId === id)?.place ?? eliminations[id]?.place ?? 99,
        score: id === session.playerId ? snap.score : (peerStatus[id]?.score ?? 0),
        lines: id === session.playerId ? snap.lines : (peerStatus[id]?.lines ?? 0),
      }))
      .sort((a, b) => a.place - b.place || b.score - a.score);
    const medal = (i: number) => (i === 0 ? "🏆" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`);
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <div className="panel panel-sharp p-8 text-center">
          <div className="text-xs tracking-[0.35em] text-cyan-300">GAME OVER — LAST STANDING</div>
          <h1 className="mt-2 text-4xl font-bold">🏆 {rows[0]?.label ?? "—"} WINS</h1>
          <div className="mt-6 space-y-1 text-left">
            {rows.map((r, i) => (
              <div key={r.id} className="flex justify-between border border-white/10 px-3 py-2 text-sm">
                <span>{medal(i)} {r.label}</span>
                <span className="font-mono2">{r.score.toLocaleString()} · {r.lines}ln</span>
              </div>
            ))}
          </div>
          <div className="mt-6 flex gap-2">
            {room.isHost && (
              <button onClick={() => room.setPhase("lobby")} className="btn-arcade flex-1 py-3 font-bold">
                PLAY AGAIN
              </button>
            )}
            <button onClick={() => router.push("/")} className="flex-1 border border-slate-600 py-3 font-bold">
              EXIT ROOM
            </button>
          </div>
        </div>
      </main>
    );
  }

  const countdownOverlay = room.phase === "countdown" && (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
      <div key={count} className="count-pop text-glow text-8xl font-bold text-cyan-300">
        {count ?? "…"}
      </div>
    </div>
  );

  if (room.phase === "lobby") {
    return (
      <main className="mx-auto max-w-5xl px-4 py-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs tracking-[0.35em] text-cyan-300">TETRIS BATTLE</div>
            <h1 className="text-3xl font-bold">
              ROOM: <span className="font-mono2 text-cyan-300">{code}</span>
            </h1>
          </div>
          <InviteButtons code={code} />
        </header>
        {!room.connected && (
          <p className="mt-2 text-sm text-amber-300">Connecting… (solo mode if Supabase env missing)</p>
        )}
        {room.notice && <p className="mt-2 text-sm text-amber-300">{room.notice}</p>}
        {room.roomFull && (
          <p className="mt-2 text-sm text-red-400">ROOM FULL — This game already has {room.config.maxPlayers} players.</p>
        )}

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="panel panel-sharp p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold tracking-[0.25em]">
                PLAYERS ({room.peers.length || 1}/{room.config.maxPlayers})
              </h2>
              {room.isHost && <span className="text-xs text-cyan-300">YOU ARE HOST</span>}
            </div>
            <div className="mt-2 max-h-56 space-y-1 overflow-y-auto text-sm">
              {(room.peers.length
                ? room.peers
                : [{ playerId: session.playerId, name: session.name, joinedAt: Date.now(), alive: true }]
              ).map((p) => (
                <div key={p.playerId} className="flex justify-between border border-white/5 px-2 py-1.5">
                  <span>● {displayNames.get(p.playerId) ?? p.name}</span>
                  {p.playerId === room.hostId && <span className="text-xs text-amber-300">HOST</span>}
                </div>
              ))}
            </div>
            {room.isHost && (
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <label className="border border-white/10 p-2">
                  MAX PLAYERS
                  <select
                    value={room.config.maxPlayers}
                    onChange={(e) => room.setConfig({ ...room.config, maxPlayers: Number(e.target.value) })}
                    className="mt-1 w-full bg-black p-1"
                  >
                    {[4, 6, 8, 10, 12, 15].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </label>
                <label className="border border-white/10 p-2">
                  GARBAGE
                  <select
                    value={room.config.garbageMode}
                    onChange={(e) =>
                      room.setConfig({ ...room.config, garbageMode: e.target.value as "chill" | "normal" | "spicy" })
                    }
                    className="mt-1 w-full bg-black p-1"
                  >
                    <option value="chill">Chill (½ atk)</option>
                    <option value="normal">Normal</option>
                    <option value="spicy">Spicy (+1)</option>
                  </select>
                </label>
              </div>
            )}
            <button
              onClick={startGame}
              disabled={!room.isHost}
              className="btn-arcade mt-4 w-full py-3 text-lg font-bold tracking-widest"
            >
              {room.isHost ? "START GAME" : "WAITING FOR HOST..."}
            </button>
            <p className="mt-2 text-[11px] text-slate-500">
              Battle: Single 0 · Double 1 · Triple 2 · Quad 4 · TSPIN 2/4/6 · B2B +1 · Combo +1~3 (cap 8).
              Pending 1000ms grace, auto-cancel 1:1, max 5 rows/500ms.
            </p>
          </div>
          <div className="space-y-4">
            <Playlist
              tracks={room.playlist}
              myId={session.playerId}
              myName={session.name}
              isHost={room.isHost}
              onAdd={addTrack}
              onRemove={removeTrack}
            />
            <Chat chat={room.chat} onSend={room.sendChat} myId={session.playerId} />
            <MusicPlayer
              tracks={room.playlist}
              order={room.music.order}
              index={room.music.index}
              startedAt={room.music.startedAt}
              isPlaying={room.music.isPlaying}
              enabled={musicOn}
              onEnable={() => setMusicOn(true)}
            />
          </div>
        </div>
      </main>
    );
  }

  // ── playing ────────────────────────────────────────────────────────────────
  const dead = snap.status === "over";
  const next5 = [...snap.queue].slice(0, 5);
  const targetLabel =
    battle.targetMode === "RANDOM"
      ? "RANDOM"
      : battle.targetMode === "ATTACKERS"
        ? "ATTACKERS"
        : `${displayNames.get(battle.targetId ?? "") ?? "—"}`;
  const spectateCandidates = room.peers.filter((p) => peerAlive(p.playerId));
  const focusId = dead ? (spectateId && peerAlive(spectateId) ? spectateId : (spectateCandidates[0]?.playerId ?? null)) : null;
  const focusBoard = focusId ? peerStatus[focusId]?.board : undefined;

  return (
    <main className="mx-auto max-w-6xl px-3 py-4">
      {countdownOverlay}
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2 text-sm">
        <span className="font-bold tracking-widest">
          TETRIS BATTLE · <span className="font-mono2 text-cyan-300">{code}</span>
        </span>
        <span>
          SURVIVORS: {aliveCount} · SCORE {snap.score.toLocaleString()} · LV {snap.level}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={battle.cycleMode}
            title="Cycle target (T)"
            className="border border-purple-400/60 bg-purple-500/10 px-2 py-1 text-xs font-bold"
          >
            TARGET: [{targetLabel}]
          </button>
          <button onClick={() => router.push("/")} className="border border-slate-600 px-2 py-1 text-xs">
            EXIT
          </button>
        </div>
      </header>

      {battle.targetMode === "TARGETED" && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400">Q/E to cycle target, click a player card to lock:</span>
          {room.peers.filter((p) => peerAlive(p.playerId)).map((p) => (
            <button
              key={p.playerId}
              onClick={() => battle.setTargetId(p.playerId)}
              className={`border px-2 py-1 ${battle.targetId === p.playerId ? "border-cyan-300 bg-cyan-400/20" : "border-slate-600"}`}
            >
              {displayNames.get(p.playerId)}
            </button>
          ))}
        </div>
      )}

      {toasts.length > 0 && (
        <div className="pointer-events-none fixed left-1/2 top-20 z-40 -translate-x-1/2 space-y-1 text-center">
          {toasts.map((t) => (
            <div key={t.id} className="border border-cyan-400/50 bg-black/80 px-4 py-1 text-sm font-bold text-cyan-200">
              {t.text}
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-col items-center gap-4 lg:flex-row lg:items-start lg:justify-center">
        <div className="flex w-full max-w-md justify-between gap-2 lg:hidden">
          <div className="panel panel-sharp p-2 text-center">
            <div className="text-[10px] tracking-widest text-slate-400">HOLD (C)</div>
            <PiecePreview type={snap.hold} cell={12} dim={!snap.canHold} />
          </div>
          <div className="panel panel-sharp p-2 text-center">
            <div className="text-[10px] tracking-widest text-slate-400">NEXT</div>
            <PiecePreview type={next5[0] ?? null} cell={12} />
          </div>
          <div className="panel panel-sharp p-2 text-center font-mono2 text-xs">
            <div>SCORE {snap.score}</div>
            <div>LINES {snap.lines} · LV {snap.level}</div>
            {snap.b2b && <div className="text-amber-300">B2B</div>}
            {snap.combo > 0 && <div className="text-cyan-300">{snap.combo} COMBO</div>}
            {battle.pendingTotal > 0 && <div className="text-red-400">☠ +{battle.pendingTotal}</div>}
          </div>
        </div>

        <div className="hidden lg:block">
          <div className="border-2 border-slate-200/90 bg-[#0d1322] p-3 text-center" style={{ width: 120 }}>
            <div className="text-[11px] tracking-[0.25em] text-slate-300">HOLD</div>
            <div className="flex h-16 items-center justify-center">
              <PiecePreview type={snap.hold} cell={13} dim={!snap.canHold} />
            </div>
            <div className="mt-2 font-mono2 text-[11px] text-slate-400">C / SHIFT</div>
          </div>
          <div className="mt-3 border border-white/10 p-2 font-mono2 text-xs leading-relaxed">
            <div>SCORE<br /><span className="text-base text-slate-100">{snap.score.toLocaleString()}</span></div>
            <div className="mt-1">LINES {snap.lines}</div>
            <div>LEVEL {snap.level}</div>
            {snap.b2b && <div className="text-amber-300">B2B ×1.5</div>}
            {snap.combo > 0 && <div className="text-cyan-300">{snap.combo} COMBO</div>}
          </div>
          {/* incoming garbage */}
          <div className="mt-3 border border-red-500/50 bg-red-950/30 p-2 text-xs">
            <div className="font-bold tracking-widest text-red-300">INCOMING [{battle.pendingTotal}]</div>
            {battle.grouped.length === 0 && <div className="text-slate-500">clear lines to cancel</div>}
            {battle.grouped.map((g) => (
              <div key={g.name} className="flex justify-between"><span>{g.name}</span><span>+{g.amount}</span></div>
            ))}
            <div className="mt-1 h-2 bg-black/60">
              <div className="h-2 bg-red-500" style={{ width: `${Math.min(100, (battle.pendingTotal / 8) * 100)}%` }} />
            </div>
          </div>
        </div>

        <div className={dead ? "opacity-60 grayscale" : ""}>
          <BoardCanvas board={snap.board} active={snap.active} ghostY={snap.ghostY} clearingRows={snap.clearingRows} width={300} />
          {dead && (
            <div className="mt-2 border border-red-500/60 bg-red-950/40 p-3 text-center text-sm">
              ☠ ELIMINATED — #{eliminations[session.playerId]?.place ?? "…"} — spectate below.
            </div>
          )}
          {/* mobile incoming */}
          <div className="mt-2 border border-red-500/50 bg-red-950/30 p-2 text-xs lg:hidden">
            <span className="font-bold text-red-300">INCOMING +{battle.pendingTotal}</span>
            {battle.grouped.length > 0 && <span className="ml-2 text-slate-300">{battle.grouped.map((g) => `${g.name} +${g.amount}`).join(" · ")}</span>}
          </div>
        </div>

        <div className="hidden lg:block">
          <div className="border-2 border-slate-200/90 bg-[#0d1322]" style={{ width: 132 }}>
            <div className="border-b-2 border-slate-200/90 px-2 py-1 text-center text-[11px] tracking-[0.25em]">NEXT</div>
            {next5.map((t, i) => (
              <div key={i} className={`flex h-[74px] items-center justify-center ${i < 4 ? "border-b border-slate-200/40" : ""}`}>
                <PiecePreview type={t} cell={i === 0 ? 13 : 10} />
              </div>
            ))}
          </div>
          <button onClick={battle.cycleMode} className="mt-3 w-full border border-purple-400/60 bg-purple-500/10 py-2 text-xs font-bold">
            TARGET: [{targetLabel}] (T)
          </button>
          {battle.targetMode === "TARGETED" && (
            <div className="mt-1 flex gap-1">
              <button onClick={() => battle.cycleTarget(-1)} className="flex-1 border border-slate-600 py-1 text-xs">◀ Q</button>
              <button onClick={() => battle.cycleTarget(1)} className="flex-1 border border-slate-600 py-1 text-xs">E ▶</button>
            </div>
          )}
        </div>

        <div className="flex gap-2 lg:hidden">
          {next5.slice(1).map((t, i) => (
            <div key={i} className="panel panel-sharp p-1"><PiecePreview type={t} cell={9} /></div>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-2 flex w-full max-w-sm gap-2 md:hidden">
        <button onClick={battle.cycleMode} className="flex-1 border border-purple-400/60 bg-purple-500/10 py-2 text-xs font-bold">
          TARGET: [{targetLabel}]
        </button>
        <button onClick={() => { battle.setTargetMode("TARGETED"); battle.cycleTarget(-1); }} className="border border-slate-600 px-3 text-xs">◀</button>
        <button onClick={() => { battle.setTargetMode("TARGETED"); battle.cycleTarget(1); }} className="border border-slate-600 px-3 text-xs">▶</button>
      </div>
      <TouchControls onAction={action} />

      {/* spectator focus */}
      {dead && focusId && (
        <section className="panel panel-sharp mx-auto mt-4 max-w-md p-3 text-center">
          <div className="text-xs tracking-[0.3em] text-slate-300">
            SPECTATING {displayNames.get(focusId)} · SURVIVORS {aliveCount}
          </div>
          <div className="mt-2 flex justify-center gap-2">
            <button onClick={() => {
              const ids = spectateCandidates.map((p) => p.playerId);
              const i = ids.indexOf(focusId);
              setSpectateId(ids[(i - 1 + ids.length) % ids.length]);
            }} className="border border-slate-600 px-3 py-1 text-xs">◀ PREV</button>
            <button onClick={() => {
              const ids = spectateCandidates.map((p) => p.playerId);
              const i = ids.indexOf(focusId);
              setSpectateId(ids[(i + 1) % ids.length]);
            }} className="border border-slate-600 px-3 py-1 text-xs">NEXT ▶</button>
          </div>
          {focusBoard && (
            <div className="mt-2 flex justify-center">
              <BoardCanvas board={TetrisEngine.decodeBoard(focusBoard)} active={null} ghostY={null} width={200} showGrid={false} />
            </div>
          )}
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-xs font-bold tracking-[0.3em] text-slate-300">PLAYERS — SURVIVORS {aliveCount}</h2>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
          {(room.peers.length ? room.peers : [{ playerId: session.playerId, name: session.name, joinedAt: 0, alive: true }]).map((p) => {
            const isMe = p.playerId === session.playerId;
            const st = isMe
              ? { score: snap.score, lines: snap.lines, level: snap.level, alive: snap.status !== "over", pending: battle.pendingTotal }
              : (peerStatus[p.playerId] ?? { score: 0, lines: 0, level: 1, alive: true, pending: 0 });
            const el = eliminations[p.playerId];
            const targeted = battle.targetMode === "TARGETED" && battle.targetId === p.playerId;
            return (
              <button
                key={p.playerId}
                onClick={() => {
                  if (!isMe && peerAlive(p.playerId)) {
                    battle.setTargetMode("TARGETED");
                    battle.setTargetId(p.playerId);
                    if (dead) setSpectateId(p.playerId);
                  }
                }}
                className={`panel panel-sharp p-2 text-left text-xs ${!st.alive || el ? "opacity-50" : ""} ${targeted ? "outline outline-2 outline-cyan-300" : ""}`}
              >
                <div className="flex justify-between font-bold">
                  <span>{el ? `☠ #${el.place}` : "●"} {displayNames.get(p.playerId) ?? p.name}</span>
                  {p.playerId === room.hostId && <span className="text-amber-300">HOST</span>}
                </div>
                <div className="mt-1 font-mono2 text-slate-400">
                  {st.score.toLocaleString()} · L{st.level} · {el ? "OUT" : `${"pending" in st && (st as { pending: number }).pending > 0 ? `☠+${(st as { pending: number }).pending} · ` : ""}${st.lines}ln`}
                </div>
                {!isMe && peerStatus[p.playerId]?.board && (
                  <MiniBoard rows={peerStatus[p.playerId].board!} />
                )}
                {isMe && <div className="mt-1 text-[10px] text-slate-500">YOU · {battle.targetMode}</div>}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          T target mode · Q/E cycle · click card to lock target / spectate. Chill=½ attack/1200ms grace · Normal=1000ms · Spicy=+1/800ms.
          {room.isHost && <button onClick={() => {
            const ids = new Set(room.peers.map((p) => p.playerId));
            if (session) ids.add(session.playerId);
            const placements = Array.from(ids).map((id) => ({
              playerId: id,
              place: eliminations[id]?.place ?? 99,
            })).sort((a, b) => a.place - b.place);
            room.broadcast({ type: "game_end", winnerId: placements[0]?.playerId ?? null, placements });
            room.setPhase("results");
          }} className="ml-2 border border-red-500/60 px-2 py-0.5 text-red-300">END MATCH (host)</button>}
        </p>
      </section>
    </main>
  );
}

function MiniBoard({ rows }: { rows: string[] }) {
  const board = useMemo(() => TetrisEngine.decodeBoard(rows), [rows]);
  return (
    <div className="mt-1">
      <BoardCanvas board={board} active={null} ghostY={null} width={110} showGrid={false} />
    </div>
  );
}

export default function Page() {
  return (
    <SessionProvider>
      <Room />
    </SessionProvider>
  );
}
