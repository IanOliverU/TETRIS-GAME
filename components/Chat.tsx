"use client";
import { useRef, useState } from "react";
import type { ChatMsg } from "@/lib/net/protocol";

export default function Chat({
  chat,
  onSend,
  myId,
}: {
  chat: ChatMsg[];
  onSend: (text: string) => void;
  myId: string;
}) {
  const [draft, setDraft] = useState("");
  const lastSent = useRef(0);
  const send = () => {
    if (Date.now() - lastSent.current < 2000) return; // rate limit
    if (!draft.trim()) return;
    lastSent.current = Date.now();
    onSend(draft);
    setDraft("");
  };
  return (
    <div className="panel panel-sharp flex h-56 flex-col">
      <div className="border-b border-white/10 px-3 py-2 text-xs font-bold tracking-[0.25em] text-slate-300">
        LOBBY CHAT
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto px-3 py-2 text-sm">
        {chat.length === 0 && (
          <p className="text-slate-500">Say hi. No voice chat in MVP.</p>
        )}
        {chat.map((m) => (
          <div key={m.id} className="leading-snug">
            <span className={m.fromId === myId ? "text-cyan-300" : "text-purple-300"}>
              {m.fromName}:{" "}
            </span>
            <span className="text-slate-200">{m.text}</span>
          </div>
        ))}
      </div>
      <div className="flex border-t border-white/10">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 200))}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") send();
          }}
          onKeyUp={(e) => e.stopPropagation()}
          placeholder="Type message..."
          className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-slate-600"
        />
        <button onClick={send} className="btn-arcade px-4 text-sm font-bold">
          SEND
        </button>
      </div>
    </div>
  );
}
