"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { TetrisEngine, type EngineSnapshot, type LockResult } from "@/lib/tetris/engine";
import { unlockGameAudio } from "@/lib/tetris/audio";

// Local simulation only. Network layer sends events (attack/eliminated/status),
// never per-frame positions. Battle manager plugs into onLock.
export function useTetris(seed?: number, active = true, soundOn = true) {
  const engineRef = useRef<TetrisEngine | null>(null);
  if (!engineRef.current) engineRef.current = new TetrisEngine(seed);
  const [snap, setSnap] = useState<EngineSnapshot>(() => engineRef.current!.snapshot());
  const [started, setStarted] = useState(false);
  const rafRef = useRef<number>(0);
  const lastDrop = useRef(0);
  const lockDelay = useRef(0);
  const das = useRef<{ dir: -1 | 1 | null; start: number; last: number }>({ dir: null, start: 0, last: 0 });
  const softDrop = useRef<{ held: boolean; last: number }>({ held: false, last: 0 });

  const refresh = useCallback(() => setSnap(engineRef.current!.snapshot()), []);

  const start = useCallback((newSeed?: number) => {
    if (newSeed !== undefined) engineRef.current!.setSeed(newSeed);
    engineRef.current!.start();
    lastDrop.current = performance.now();
    setStarted(true);
    refresh();
  }, [refresh]);

  const onLockRef = useRef<((r: LockResult) => void) | null>(null);
  const setOnLock = useCallback((fn: ((r: LockResult) => void) | null) => {
    onLockRef.current = fn;
  }, []);

  const doLock = useCallback(() => {
    const res = engineRef.current!.lockPiece();
    if (res.locked) onLockRef.current?.(res);
    refresh();
  }, [refresh]);

  // gravity + lock delay loop
  useEffect(() => {
    if (!active || !started) return;
    const loop = (t: number) => {
      const eng = engineRef.current!;
      if (eng.status === "playing") {
        // DAS / ARR
        const d = das.current;
        if (d.dir !== null) {
          if (t - d.start > 150 && t - d.last > 35) {
            d.last = t;
            if (d.dir === -1) eng.moveLeft();
            else eng.moveRight();
            refresh();
          }
        }
        if (softDrop.current.held && t - softDrop.current.last >= 45) {
          softDrop.current.last = t;
          if (eng.softDropStep()) {
            lastDrop.current = t;
            refresh();
          }
        }
        const interval = eng.getIntervalMs();
        const blocked =
          !eng.active ||
          eng.collides(eng.active.type, eng.active.rotation, eng.active.x, eng.active.y + 1);
        if (!blocked) {
          if (t - lastDrop.current > interval) {
            lastDrop.current = t;
            eng.softDropStep();
            // soft-drop scoring during gravity would inflate; revert 1pt? keep classic: only manual soft scores.
            eng.score = Math.max(0, eng.score - 1);
            refresh();
          }
          lockDelay.current = 0;
        } else {
          if (lockDelay.current === 0) lockDelay.current = t;
          if (t - lockDelay.current > 500) {
            lockDelay.current = 0;
            lastDrop.current = t;
            doLock();
          }
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, started, refresh, doLock]);

  const action = useCallback(
    (a: "left" | "right" | "down" | "cw" | "ccw" | "hard" | "hold") => {
      const eng = engineRef.current!;
      if (eng.status !== "playing") return;
      if (soundOn) unlockGameAudio();
      switch (a) {
        case "left": eng.moveLeft(); break;
        case "right": eng.moveRight(); break;
        case "down":
          if (eng.softDropStep()) lastDrop.current = performance.now();
          break;
        case "cw": eng.rotateCW(); break;
        case "ccw": eng.rotateCCW(); break;
        case "hard": {
          const { result } = eng.hardDrop();
          if (result?.locked) onLockRef.current?.(result);
          lastDrop.current = performance.now();
          break;
        }
        case "hold": eng.holdPiece(); break;
      }
      refresh();
    },
    [refresh, soundOn]
  );

  const setSoftDropHeld = useCallback((held: boolean) => {
    softDrop.current = { held, last: performance.now() };
  }, []);

  // keyboard (disabled when typing in inputs or modal open)
  useEffect(() => {
    if (!active) return;
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.dataset?.nameInput !== undefined)) return;
      if (["ArrowLeft", "ArrowRight", "ArrowDown", "Space"].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      switch (e.code) {
        case "ArrowLeft": case "KeyA": das.current = { dir: -1, start: performance.now(), last: performance.now() }; action("left"); break;
        case "ArrowRight": case "KeyD": das.current = { dir: 1, start: performance.now(), last: performance.now() }; action("right"); break;
        case "ArrowDown": case "KeyS": softDrop.current = { held: true, last: performance.now() }; action("down"); break;
        case "ArrowUp": case "KeyX": case "KeyW": action("cw"); break;
        case "KeyZ": action("ccw"); break;
        case "Space": action("hard"); break;
        case "KeyC": case "ShiftLeft": case "ShiftRight": action("hold"); break;
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") { if (das.current.dir === -1) das.current.dir = null; }
      if (e.code === "ArrowRight" || e.code === "KeyD") { if (das.current.dir === 1) das.current.dir = null; }
      if (e.code === "ArrowDown" || e.code === "KeyS") softDrop.current.held = false;
    };
    const blur = () => { das.current.dir = null; softDrop.current.held = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [active, action]);

  return { snap, started, start, action, setSoftDropHeld, refresh, setOnLock, engine: engineRef.current! };
}
