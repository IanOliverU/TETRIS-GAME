"use client";

export default function TouchControls({
  onAction,
  onSoftDropHeld,
}: {
  onAction: (a: "left" | "right" | "down" | "cw" | "hard" | "hold") => void;
  onSoftDropHeld?: (held: boolean) => void;
}) {
  const btn =
    "select-none border border-slate-500/60 bg-white/5 px-4 py-3 text-sm font-bold tracking-widest active:bg-cyan-400/30";
  const press = (a: "left" | "right" | "down" | "cw" | "hard" | "hold") => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      onAction(a);
      if (a === "down") onSoftDropHeld?.(true);
    },
    onPointerUp: () => { if (a === "down") onSoftDropHeld?.(false); },
    onPointerCancel: () => { if (a === "down") onSoftDropHeld?.(false); },
    onPointerLeave: () => { if (a === "down") onSoftDropHeld?.(false); },
  });
  return (
    <div className="mx-auto mt-3 w-full max-w-sm space-y-2 md:hidden">
      <div className="flex justify-center gap-2">
        <button className={btn} {...press("cw")}>ROTATE</button>
        <button className={btn} {...press("hold")}>HOLD</button>
      </div>
      <div className="flex justify-center gap-2">
        <button className={btn} {...press("left")}>◀ LEFT</button>
        <button className={btn} {...press("down")}>▼ DOWN</button>
        <button className={btn} {...press("right")}>RIGHT ▶</button>
      </div>
      <button className={`${btn} w-full border-cyan-400/60`} {...press("hard")}>
        HARD DROP (SPACE)
      </button>
    </div>
  );
}
