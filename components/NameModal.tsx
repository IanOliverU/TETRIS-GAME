"use client";
import { useEffect, useRef, useState } from "react";
import { sanitizeName, validateName } from "@/lib/session";
import PiecePreview from "./PiecePreview";
import { COLORS, type TetrominoType } from "@/lib/tetris/constants";

const entryRows = [
  "0000000000", "000TTT0000", "0000T00000", "0000000000",
  "0000000000", "0000000000", "0000000000", "0000000000",
  "0000000000", "0000000000", "JJ00000000", "J00000LL00",
  "JSS0000LZZ", "SSOO0I0LLZ", "TTOO0I00ZZ", "TTLL0ISSOO",
];

function EntryBoard() {
  return (
    <div className="entry-board" aria-hidden="true">
      {entryRows.flatMap((row, y) => [...row].map((cell, x) => (
        <span key={`${x}-${y}`} className={`entry-board__cell ${cell !== "0" ? "entry-board__block" : ""} ${y < 3 && cell !== "0" ? "entry-board__falling" : ""}`}
          style={cell !== "0" ? { background: `linear-gradient(145deg, ${COLORS[cell as TetrominoType].main}, ${COLORS[cell as TetrominoType].dark})` } : undefined} />
      )))}
    </div>
  );
}

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
    <div className="entry-screen">
      <div className="entry-pieces" aria-hidden="true">
        {(["I", "T", "S", "L", "O", "J"] as TetrominoType[]).map((piece, i) => (
          <div key={piece} className={`entry-piece entry-piece--${i}`}><PiecePreview type={piece} cell={38} /></div>
        ))}
      </div>
      <div className="entry-card">
        <div className="entry-showcase">
          <div className="entry-brand">TETRIS<span>BATTLE</span></div>
          <EntryBoard />
          <div className="entry-showcase__caption">STACK. CLEAR. SURVIVE.</div>
        </div>
        <form className="entry-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div className="entry-eyebrow"><span /> PLAYER SELECT</div>
        <h1 className="entry-heading">
          WHAT SHOULD WE CALL YOU?
        </h1>
        <p className="entry-intro">Pick a name. Your next battle starts here.</p>
        {roomCode && (
          <p className="mt-3 text-sm text-slate-300">
            You were invited to room{" "}
            <span className="font-mono2 font-bold text-cyan-300">{roomCode}</span>.
            Enter your name to join.
          </p>
        )}
        <label htmlFor="player-name" className="entry-label">PLAYER NAME</label>
        <input
          id="player-name"
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
          }}
          onKeyUp={(e) => e.stopPropagation()}
          placeholder="Your nickname"
          maxLength={16}
          autoComplete="off"
          data-name-input
          aria-invalid={!!error}
          aria-describedby={error ? "player-name-error" : undefined}
          className="entry-input"
        />
        {error && <p id="player-name-error" role="alert" className="mt-2 text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          className="entry-play"
        >
          LET&apos;S PLAY <span aria-hidden="true">→</span>
        </button>
        <div className="entry-key-hint">or press <kbd>Enter ↵</kbd></div>
        <p className="entry-note">
          No accounts. Name lives only in this tab.
          <br />
          Refresh = you start over as a new player.
        </p>
        </form>
      </div>
    </div>
  );
}
