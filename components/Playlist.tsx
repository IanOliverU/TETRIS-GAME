"use client";
import { useState } from "react";
import type { PlaylistTrack } from "@/lib/net/protocol";
import { parseYouTubeId } from "@/lib/youtube";

function parseSpotifyTrack(url: string): string | null {
  const m = url.match(/open\.spotify\.com\/track\/([A-Za-z0-9]+)/);
  return m ? m[1] : null;
}

export default function Playlist({
  tracks,
  myId,
  myName,
  isHost,
  onAdd,
  onRemove,
}: {
  tracks: PlaylistTrack[];
  myId: string;
  myName: string;
  isHost: boolean;
  onAdd: (t: PlaylistTrack) => void;
  onRemove: (id: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);

  const myCount = tracks.filter((t) => t.addedById === myId).length;

  const add = async () => {
    setError(null);
    const yt = parseYouTubeId(url);
    const sp = yt ? null : parseSpotifyTrack(url);
    if (!yt && !sp) {
      setError("Unsupported link. Please use a YouTube or Spotify link.");
      return;
    }
    if (myCount >= 3) {
      setError("Max 3 songs per player.");
      return;
    }
    const id = yt ?? `sp:${sp}`;
    if (tracks.some((t) => t.videoId === id)) {
      setError("This song is already in the playlist.");
      return;
    }
    let title = yt ? "YouTube Track" : "Spotify Track";
    let artist: string | undefined;
    if (yt) {
      try {
        const r = await fetch(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
        );
        if (r.ok) {
          const j = await r.json();
          title = (j.title as string).slice(0, 80) || title;
          artist = (j.author_name as string)?.slice(0, 60);
        }
      } catch {
        // fallback title kept
      }
    }
    onAdd({
      id: `${myId}-${Date.now()}`,
      platform: yt ? "youtube" : "spotify",
      videoId: id,
      url: url.trim(),
      title,
      artist,
      addedById: myId,
      addedByName: myName,
      addedAt: Date.now(),
    });
    setUrl("");
    setShow(false);
  };

  return (
    <div className="panel panel-sharp flex h-56 flex-col">
      <div className="border-b border-white/10 px-3 py-2 text-xs font-bold tracking-[0.25em] text-slate-300">
        MUSIC — SHARED LOBBY PLAYLIST ({tracks.length})
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto px-3 py-2 text-sm">
        {tracks.length === 0 && (
          <p className="text-slate-500">
            No songs yet. YouTube plays in-game. Spotify links are saved + open externally.
          </p>
        )}
        {tracks.map((t) => (
          <div key={t.id} className="flex items-center gap-2 leading-tight">
            <span>🎵</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-slate-100">
                {t.title}{" "}
                {t.platform === "spotify" && (
                  <a
                    href={t.url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-1 text-[11px] text-green-400 underline"
                  >
                    open
                  </a>
                )}
              </div>
              <div className="truncate text-[11px] text-slate-500">
                {t.artist ? `${t.artist} · ` : ""}Added by {t.addedByName}
                {t.platform === "spotify" ? " · Spotify (external)" : ""}
              </div>
            </div>
            {(t.addedById === myId || isHost) && (
              <button
                onClick={() => onRemove(t.id)}
                className="px-1 text-slate-500 hover:text-red-400"
                title="Remove"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="border-t border-white/10 p-2">
        {!show ? (
          <button onClick={() => setShow(true)} className="btn-arcade w-full py-1.5 text-sm font-bold">
            + ADD SONG
          </button>
        ) : (
          <div className="space-y-1">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") add();
                if (e.key === "Escape") setShow(false);
              }}
              onKeyUp={(e) => e.stopPropagation()}
              placeholder="Paste YouTube or Spotify link"
              className="w-full border border-slate-600 bg-black/60 px-2 py-1.5 text-sm outline-none focus:border-cyan-400"
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-2">
              <button onClick={add} className="btn-arcade flex-1 py-1 text-sm font-bold">
                ADD SONG
              </button>
              <button onClick={() => setShow(false)} className="border border-slate-600 px-3 text-sm">
                ✕
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
