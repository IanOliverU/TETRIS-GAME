"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabase, isRealtimeConfigured } from "./supabase";
import {
  CHANNEL_PREFIX,
  ChatMsg,
  GamePhase,
  NetEvent,
  PlaylistTrack,
  PresenceState,
  RoomConfig,
  channelName,
} from "./protocol";

interface UseRoomArgs {
  code: string;
  playerId: string;
  name: string;
  enabled: boolean;
}

export function useRoom({ code, playerId, name, enabled }: UseRoomArgs) {
  const [connected, setConnected] = useState(false);
  const [peers, setPeers] = useState<PresenceState[]>([]);
  const [hostId, setHostId] = useState<string>(playerId);
  const [phase, setPhase] = useState<GamePhase>("lobby");
  const [config, setConfig] = useState<RoomConfig>({ maxPlayers: 15, garbageMode: "normal", gameMode: "survival" });
  const [seed, setSeed] = useState<number>(() => Math.floor(Math.random() * 2 ** 31));
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [playlist, setPlaylist] = useState<PlaylistTrack[]>([]);
  const [music, setMusic] = useState<{ index: number; startedAt: number; isPlaying: boolean; order: string[] }>({
    index: 0, startedAt: Date.now(), isPlaying: false, order: [],
  });
  const [pendingStart, setPendingStart] = useState<{ startAt: number; seed: number } | null>(null);
  const [placements, setPlacements] = useState<{ playerId: string; place: number }[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const joinedAt = useRef<number>(Date.now());
  const hostIdRef = useRef<string>(playerId);
  const configRef = useRef<RoomConfig>({ maxPlayers: 15, garbageMode: "normal", gameMode: "survival" });
  const phaseRef = useRef<GamePhase>("lobby");
  const seedRef = useRef<number>(0);
  useEffect(() => { hostIdRef.current = hostId; }, [hostId]);
  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { seedRef.current = seed; }, [seed]);
  const chanRef = useRef<ReturnType<NonTypeGuard> | null>(null);

  type NonTypeGuard = never;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chanRefAny = chanRef as React.MutableRefObject<any>;

  const isHost = hostId === playerId;
  const roomFull = peers.length >= config.maxPlayers;
  const solo = !isRealtimeConfigured();

  // deterministic host: lowest joinedAt (ties → lowest playerId)
  const electHost = useCallback((list: PresenceState[]) => {
    if (list.length === 0) return;
    const sorted = [...list].sort((a, b) =>
      a.joinedAt === b.joinedAt ? (a.playerId < b.playerId ? -1 : 1) : a.joinedAt - b.joinedAt
    );
    setHostId((prev) => {
      if (prev !== sorted[0].playerId) {
        setNotice(
          prev === playerId
            ? `You are now the host.`
            : `${sorted[0].name} is now the host.`
        );
      }
      return sorted[0].playerId;
    });
  }, [playerId]);

  const broadcast = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (evt: NetEvent) => {
      const ch = chanRefAny.current;
      if (!ch) return;
      ch.send({ type: "broadcast", event: "evt", payload: evt });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    if (!enabled || !code || !playerId) return;
    const supa = getSupabase();
    if (!supa) {
      // Solo/offline mode: just self.
      setConnected(true);
      setPeers([{ playerId, name, joinedAt: joinedAt.current, alive: true }]);
      setHostId(playerId);
      return;
    }
    joinedAt.current = Date.now();
    const ch = supa.channel(channelName(code), {
      config: { broadcast: { self: false }, presence: { key: playerId } },
    });
    chanRefAny.current = ch;

    ch.on("broadcast", { event: "evt" }, ({ payload }: { payload: NetEvent }) => {
      const evt = payload as NetEvent;
      switch (evt.type) {
        case "room_state":
          setHostId(evt.hostId);
          setConfig({ ...evt.config, gameMode: evt.config.gameMode ?? "survival" });
          setPhase(evt.phase);
          setSeed(evt.seed);
          break;
        case "request_state":
          // Host-only answer (refs avoid stale closure; prevents split-brain hostId).
          if (hostIdRef.current === playerId) {
            ch.send({
              type: "broadcast",
              event: "evt",
              payload: {
                type: "room_state",
                hostId: hostIdRef.current,
                config: configRef.current,
                phase: phaseRef.current,
                seed: seedRef.current,
              } satisfies NetEvent,
            });
          }
          break;
        case "chat":
          setChat((c) => [...c.slice(-49), evt.msg]);
          break;
        case "playlist_add":
          setPlaylist((p) => (p.some((t) => t.id === evt.track.id) ? p : [...p, evt.track]));
          break;
        case "playlist_remove":
          setPlaylist((p) => p.filter((t) => t.id !== evt.trackId));
          break;
        case "music_state":
          setMusic({ index: evt.index, startedAt: evt.startedAt, isPlaying: evt.isPlaying, order: evt.order });
          break;
        case "game_start":
          setConfig((current) => ({ ...current, gameMode: evt.gameMode ?? "survival" }));
          setPendingStart({ startAt: evt.startAt, seed: evt.seed });
          setSeed(evt.seed);
          setPhase("countdown");
          setPlacements([]);
          if (evt.playlistOrder.length) {
            setMusic((m) => ({ ...m, order: evt.playlistOrder, index: 0, startedAt: evt.startAt, isPlaying: true }));
          }
          break;
        case "game_end":
          setPhase("results");
          setPlacements(evt.placements);
          setPendingStart(null);
          break;
        default:
          // attack / eliminated / status handled by game layer via window event
          window.dispatchEvent(new CustomEvent("tetris-net", { detail: evt }));
          break;
      }
    });

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState() as Record<string, PresenceState[]>;
      const list: PresenceState[] = Object.values(state).flat();
      setPeers(list);
      electHost(list.length ? list : [{ playerId, name, joinedAt: joinedAt.current, alive: true }]);
    });

    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({ playerId, name, joinedAt: joinedAt.current, alive: true } as PresenceState);
        setConnected(true);
        // ask host for current state (playlist, phase, config)
        ch.send({ type: "broadcast", event: "evt", payload: { type: "request_state", fromId: playerId } satisfies NetEvent });
      }
    });

    return () => {
      supa.removeChannel(ch);
      chanRefAny.current = null;
      setConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, code, playerId, name]);

  // host rebroadcasts room_state when host/config/phase changes
  useEffect(() => {
    if (!isHost || !connected) return;
    const supa = getSupabase();
    if (!supa) return;
    broadcast({ type: "room_state", hostId, config, phase, seed });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, phase, config.maxPlayers, config.garbageMode, config.gameMode, seed, connected]);

  const sendChat = useCallback(
    (text: string) => {
      const t = text.trim().slice(0, 200);
      if (!t) return;
      const msg: ChatMsg = { id: `${playerId}-${Date.now()}`, fromId: playerId, fromName: name, text: t, at: Date.now() };
      setChat((c) => [...c.slice(-49), msg]);
      broadcast({ type: "chat", msg });
    },
    [broadcast, playerId, name]
  );

  const updatePresence = useCallback((patch: Partial<PresenceState>) => {
    const ch = chanRefAny.current;
    if (!ch) return;
    ch.track({ playerId, name, joinedAt: joinedAt.current, alive: true, ...patch } as PresenceState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId, name]);

  return {
    connected, peers, hostId, isHost, phase, setPhase,
    config, setConfig, seed, setSeed, chat, sendChat,
    playlist, setPlaylist, music, setMusic,
    pendingStart, setPendingStart, placements, notice, roomFull, solo,
    broadcast, updatePresence, channelPrefix: CHANNEL_PREFIX,
  };
}
