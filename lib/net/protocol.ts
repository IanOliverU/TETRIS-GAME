// Event-only multiplayer protocol. Board simulation stays local.
// Channel: `tetris:<ROOMCODE>` via Supabase Realtime Broadcast + Presence.

export type GamePhase = "lobby" | "countdown" | "playing" | "results";

export interface PresenceState {
  playerId: string;
  name: string;
  joinedAt: number;
  alive: boolean;
  // lightweight status tick (2Hz while playing, presence merge on join)
  score?: number;
  lines?: number;
  level?: number;
  pending?: number;
}

export interface PlaylistTrack {
  id: string;
  platform: "youtube" | "spotify";
  videoId: string; // youtube videoId or spotify track id
  url: string;
  title: string;
  artist?: string;
  addedById: string;
  addedByName: string;
  addedAt: number;
}

export interface ChatMsg {
  id: string;
  fromId: string;
  fromName: string;
  text: string;
  at: number;
}

export interface RoomConfig {
  maxPlayers: number; // 4..15
  garbageMode: "chill" | "normal" | "spicy";
  gameMode: "survival" | "knockout";
}

// ── Broadcast events (client → relay → all) ──────────────────────────────────
export type NetEvent =
  | { type: "room_state"; hostId: string; config: RoomConfig; phase: GamePhase; seed: number }
  | { type: "request_state"; fromId: string }
  | { type: "chat"; msg: ChatMsg }
  | { type: "playlist_add"; track: PlaylistTrack }
  | { type: "playlist_remove"; trackId: string; byId: string }
  | { type: "music_state"; index: number; startedAt: number; isPlaying: boolean; order: string[] }
  | { type: "game_start"; startAt: number; seed: number; playlistOrder: string[]; gameMode: RoomConfig["gameMode"] }
  | { type: "game_end"; winnerId: string | null; placements: { playerId: string; place: number }[] }
  | { type: "attack"; attackId: string; fromId: string; fromName: string; toId: string; amount: number }
  | { type: "eliminated"; playerId: string; place: number; lastAttackerId?: string }
  | { type: "knockout"; playerId: string; attackerId?: string; lives: number }
  | { type: "status"; playerId: string; score: number; lines: number; level: number; alive: boolean; pending: number; lives?: number; kos?: number; board?: string[] };

export const CHANNEL_PREFIX = "tetris:";

export function channelName(code: string): string {
  return `${CHANNEL_PREFIX}${code.toUpperCase()}`;
}
