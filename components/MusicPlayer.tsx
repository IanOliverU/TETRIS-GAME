"use client";
import { useMemo } from "react";
import type { PlaylistTrack } from "@/lib/net/protocol";

// Native controls let playback with sound begin from a real user gesture.
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
  const youtubeTracks = tracks.filter((t) => t.platform === "youtube");
  const ordered = useMemo(() => {
    const byId = new Map(youtubeTracks.map((track) => [track.id, track]));
    return order.length ? order.map((id) => byId.get(id)).filter((t): t is PlaylistTrack => !!t) : youtubeTracks;
  }, [youtubeTracks, order]);
  const current = ordered[Math.min(index, Math.max(0, ordered.length - 1))];
  const start = useMemo(
    () => isPlaying ? Math.max(0, Math.min(30, Math.floor((Date.now() - startedAt) / 1000))) : 0,
    [current?.videoId, startedAt, isPlaying]
  );
  const src = current
    ? `https://www.youtube.com/embed/${current.videoId}?controls=1&playsinline=1&rel=0&start=${start}`
    : null;

  return (
    <div className="panel panel-sharp p-3 text-sm">
      <div className="font-bold tracking-widest">♫ GAME MUSIC</div>
      {!current ? (
        <p className="mt-1 text-slate-400">Add a YouTube song to the playlist to play it here.</p>
      ) : !enabled ? (
        <>
          <p className="mt-1 truncate text-slate-400">{current.title}</p>
          <button onClick={onEnable} className="btn-arcade mt-2 w-full py-1.5 font-bold">SHOW PLAYER</button>
        </>
      ) : (
        <>
          <p className="mt-1 truncate text-slate-300">{current.title}</p>
          <iframe
            key={current.videoId}
            title={`YouTube player: ${current.title}`}
            src={src ?? undefined}
            width="220"
            height="124"
            className="mt-2 block max-w-full border border-slate-600 bg-black"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
          <p className="mt-1 text-xs text-slate-400">Press play in the video for sound. <a href={`https://www.youtube.com/watch?v=${current.videoId}`} target="_blank" rel="noreferrer" className="text-cyan-300 underline">Open on YouTube</a></p>
        </>
      )}
    </div>
  );
}
