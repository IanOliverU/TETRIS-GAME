"use client";
import { useState } from "react";
import { inviteLink } from "@/lib/room";

export default function InviteButtons({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const link = typeof window !== "undefined" ? inviteLink(code) : `/game/${code}`;
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = link;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    try {
      await navigator.share({
        title: "Tetris Battle",
        text: `Join my Tetris Battle! Room: ${code}`,
        url: link,
      });
    } catch {
      // user cancelled or failed → fall back to copy
      copy();
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={copy} className="btn-arcade px-4 py-2 text-sm font-bold tracking-widest">
        {copied ? "✓ INVITE COPIED!" : "COPY INVITE LINK"}
      </button>
      {canShare && (
        <button
          onClick={share}
          className="border border-slate-600 bg-white/5 px-4 py-2 text-sm font-bold tracking-widest hover:bg-white/10"
        >
          SHARE
        </button>
      )}
      <span className="font-mono2 text-xs text-slate-400">{link}</span>
    </div>
  );
}
