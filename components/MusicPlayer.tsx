"use client";
import { useEffect, useRef, useState } from "react";
import type { PlaylistTrack } from "@/lib/net/protocol";

// Compliant YouTube playback: visible mini-player (≥200px), IFrame API,
// no hiding, no audio extraction. Per-player mute/volume only affects self.
declare global {
  interface Window {
    YT?: {
      Player: new (
        el: HTMLElement,
        opts: {
          width: number;
          height: number;
          videoId: string;
          playerVars?: Record<string, string | number>;
          events?: Record<string, (e: { data: number; target: { getVideoData?: () => { title?: string } } }) => void>;
        }
      ) => {
        loadVideoById: (id: string | { videoId: string; startSeconds?: number }) => void;
        cueVideoById: (id: string) => void;
        playVideo: () => void;
        pauseVideo: () => void;
        mute: () => void;
        unMute: () => void;
        setVolume: (v: number) => void;
        destroy: () => void;
      };
      PlayerState: { ENDED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export default function MusicPlayer({
  tracks,
  order,
  index,
  startedAt,
  isPlaying,
  enabled,
  onEnable,
}: {
  tracks: PlaylistTrack[];
  order: string[];
  index: number;
  startedAt: number;
  isPlaying: boolean;
  enabled: boolean;
  onEnable: () => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Window["YT"] extends undefined ? never : unknown>(null);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(80);
  const [blocked, setBlocked] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerAny = playerRef as React.MutableRefObject<any>;

  const youtubeTracks = tracks.filter((t) => t.platform === "youtube");
  const orderedIds: string[] =
    order.length > 0
      ? order.map((id) => tracks.find((t) => t.id === id)?.videoId).filter(Boolean) as string[]
      : youtubeTracks.map((t) => t.videoId);
  const currentId = orderedIds[Math.min(index, Math.max(0, orderedIds.length - 1))];

  useEffect(() => {
    if (!enabled || !mountRef.current || playerAny.current) return;
    const init = () => {
      if (!mountRef.current || !window.YT || playerAny.current) return;
      playerAny.current = new window.YT.Player(mountRef.current, {
        width: 220,
        height: 124,
        videoId: currentId ?? "dQw4w9WgXcQ",
        playerVars: { autoplay: 1, mute: 1, rel: 0, modestbranding: 1 },
        events: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onReady: (e: any) => {
            try {
              e.target.mute?.();
            } catch {}
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onStateChange: (e: any) => {
            if (e.data === window.YT?.PlayerState.ENDED) {
              // advance handled by parent via music_state in phase 2; here just loop
            }
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onAutoplayBlocked: (_e: any) => setBlocked(true),
        } as unknown as Record<string, (e: { data: number; target: { getVideoData?: () => { title?: string } } }) => void>,
      });
    };
    if (window.YT) init();
    else {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
      window.onYouTubeIframeAPIReady = init;
    }
    return () => {
      try {
        playerAny.current?.destroy?.();
      } catch {}
      playerAny.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !playerAny.current || !currentId) return;
    try {
      const offset = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      playerAny.current.loadVideoById({ videoId: currentId, startSeconds: Math.min(offset, 30) });
      if (!isPlaying) playerAny.current.pauseVideo();
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, enabled]);

  useEffect(() => {
    if (!playerAny.current) return;
    try {
      if (muted) playerAny.current.mute();
      else playerAny.current.unMute();
      playerAny.current.setVolume(volume);
    } catch {}
  }, [muted, volume]);

  if (!enabled) {
    return (
      <div className="panel panel-sharp p-3 text-sm">
        <div className="font-bold tracking-widest">🎵 GAME MUSIC</div>
        <p className="mt-1 text-slate-400">
          Lobby playlist {youtubeTracks.length > 0 ? `(${youtubeTracks.length} YouTube)` : "(empty)"}. Click once to enable audio (browser rule).
        </p>
        <button onClick={onEnable} className="btn-arcade mt-2 w-full py-1.5 text-sm font-bold">
          ENABLE MUSIC
        </button>
        {blocked && <p className="mt-1 text-xs text-amber-300">Click to enable music</p>}
      </div>
    );
  }

  return (
    <div className="panel panel-sharp p-2">
      <div className="flex items-center justify-between px-1 pb-1 text-xs">
        <span className="font-bold tracking-widest">🎵 NOW PLAYING (YOU ONLY)</span>
        <span className="text-slate-500">{youtubeTracks.length} YT</span>
      </div>
      {/* Visible player — required by YouTube terms (min 200px, not hidden). */}
      <div ref={mountRef} className="h-[124px] w-[220px] overflow-hidden bg-black" />
      <div className="mt-2 flex items-center gap-2 px-1 text-xs">
        <button onClick={() => setMuted((m) => !m)} className="border border-slate-600 px-2 py-1 font-bold">
          {muted ? "🔇 UNMUTE" : "🔊 MUTE"}
        </button>
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="flex-1"
          aria-label="Volume"
        />
        <span className="w-8 text-right font-mono2">{volume}</span>
      </div>
      <p className="px-1 pt-1 text-[11px] text-slate-500">
        Muting affects only you. Spotify tracks open externally.
      </p>
    </div>
  );
}
