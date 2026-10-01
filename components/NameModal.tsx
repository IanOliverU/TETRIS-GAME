"use client";
import { useEffect, useRef, useState } from "react";
import { sanitizeName, validateName } from "@/lib/session";

export default function NameModal({
  roomCode,
  onDone,
}: {
  roomCode?: string;
  onDone: (name: string) => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = () => {
    const err = validateName(value);
    if (err) {
      setError(err);
      return;
    }
    onDone(sanitizeName(value));
  };

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="panel panel-sharp w-full max-w-md p-8 text-center">
        <div className="text-xs tracking-[0.35em] text-cyan-300/80">TETRIS BATTLE</div>
        <h1 className="mt-2 text-3xl font-bold tracking-wide">
          WHAT SHOULD WE CALL YOU?
        </h1>
        {roomCode && (
          <p className="mt-3 text-sm text-slate-300">
            You were invited to room{" "}
            <span className="font-mono2 font-bold text-cyan-300">{roomCode}</span>.
            Enter your name to join.
          </p>
        )}
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") submit();
          }}
          onKeyUp={(e) => e.stopPropagation()}
          placeholder="Ian Oliver"
          maxLength={16}
          autoComplete="off"
          data-name-input
          className="mt-6 w-full border border-slate-600 bg-black/60 px-4 py-3 text-center text-xl tracking-wide outline-none placeholder:text-slate-600 focus:border-cyan-400"
        />
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        <button
          onClick={submit}
          className="btn-arcade mt-6 w-full px-6 py-3 text-lg font-bold tracking-widest"
        >
          LET&apos;S PLAY
        </button>
        <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
          No accounts. Name lives only in this tab.
          <br />
          Refresh = you start over as a new player.
        </p>
      </div>
    </div>
  );
}
