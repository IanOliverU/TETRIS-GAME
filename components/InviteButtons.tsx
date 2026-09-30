"use client";
import { useState } from "react";
import { inviteLink } from "@/lib/room";

export default function InviteButtons({ code }: { code: string }) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const link = typeof window !== "undefined" ? inviteLink(code) : `/game/${code}`;
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
  };

  const copyLink = async () => {
    await copyText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const copyCode = async () => {
    await copyText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const share = async () => {
    try {
      await navigator.share({
        title: "Tetris Battle",
        text: `Join my Tetris Battle! Room: ${code}`,
        url: link,
      });
    } catch {
      // user cancelled or failed → fall back to copy link
      copyLink();
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="border border-dashed border-slate-500 bg-black/40 px-3 py-2 font-mono2 text-sm font-bold tracking-[0.2em] text-cyan-200">
        {code}
      </span>
      <button onClick={copyCode} className="border border-slate-500 bg-white/5 px-4 py-2 text-sm font-bold tracking-widest hover:bg-white/10">
        {copiedCode ? "✓ CODE COPIED!" : "COPY CODE"}
      </button>
      <button onClick={copyLink} className="btn-arcade px-4 py-2 text-sm font-bold tracking-widest">
        {copiedLink ? "✓ INVITE COPIED!" : "COPY INVITE LINK"}
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
