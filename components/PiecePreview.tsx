"use client";
import { COLORS, SHAPES, type TetrominoType } from "@/lib/tetris/constants";

export default function PiecePreview({
  type,
  cell = 14,
  dim = false,
}: {
  type: TetrominoType | null;
  cell?: number;
  dim?: boolean;
}) {
  if (!type) return <div className="flex h-full items-center justify-center text-slate-600">—</div>;
  const shape = SHAPES[type][0];
  const rows = shape.length;
  const cols = shape[0].length;
  const c = COLORS[type];
  // trim empty rows/cols
  let r0 = rows, r1 = -1, c0 = cols, c1 = -1;
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++)
      if (shape[y][x]) { r0 = Math.min(r0, y); r1 = Math.max(r1, y); c0 = Math.min(c0, x); c1 = Math.max(c1, x); }
  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${c1 - c0 + 1}, ${cell}px)`,
        opacity: dim ? 0.35 : 1,
      }}
    >
      {Array.from({ length: r1 - r0 + 1 }).map((_, y) =>
        Array.from({ length: c1 - c0 + 1 }).map((_, x) => {
          const filled = shape[r0 + y][c0 + x];
          return (
            <div
              key={`${y}-${x}`}
              style={{
                width: cell,
                height: cell,
                background: filled ? `linear-gradient(180deg, ${c.main}, ${c.dark})` : "transparent",
                border: filled ? "1px solid rgba(0,0,0,0.5)" : "none",
                boxShadow: filled ? `0 0 8px ${c.glow}` : "none",
              }}
            />
          );
        })
      )}
    </div>
  );
}
