"use client";
import { useEffect, useRef } from "react";
import { COLS, ROWS, HIDDEN_ROWS, COLORS, type Cell } from "@/lib/tetris/constants";
import type { ActivePiece } from "@/lib/tetris/engine";
import { SHAPES } from "@/lib/tetris/constants";

function drawCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  dark: string,
  ghost = false
) {
  const px = x * size;
  const py = y * size;
  if (ghost) {
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = Math.max(1, size * 0.08);
    ctx.strokeRect(px + 1, py + 1, size - 2, size - 2);
    ctx.globalAlpha = 1;
    return;
  }
  const g = ctx.createLinearGradient(px, py, px, py + size);
  g.addColorStop(0, color);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.fillRect(px + 1, py + 1, size - 2, size - 2);
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.fillRect(px + 2, py + 2, size - 4, Math.max(1, size * 0.18));
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);
}

export default function BoardCanvas({
  board,
  active,
  ghostY,
  clearingRows = [],
  width = 300,
  showGrid = true,
}: {
  board: Cell[][];
  active: ActivePiece | null;
  ghostY: number | null;
  clearingRows?: number[];
  width?: number;
  showGrid?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const size = width / COLS;
  const height = size * ROWS;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = "#05080f";
    ctx.fillRect(0, 0, width, height);

    if (showGrid) {
      ctx.strokeStyle = "rgba(148,163,184,0.12)";
      ctx.lineWidth = 1;
      for (let x = 1; x < COLS; x++) {
        ctx.beginPath();
        ctx.moveTo(x * size + 0.5, 0);
        ctx.lineTo(x * size + 0.5, height);
        ctx.stroke();
      }
      for (let y = 1; y < ROWS; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * size + 0.5);
        ctx.lineTo(width, y * size + 0.5);
        ctx.stroke();
      }
    }

    const flash = new Set(clearingRows.map((r) => r - HIDDEN_ROWS));

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const cell = board[y + HIDDEN_ROWS]?.[x] as Cell | undefined;
        if (cell === 0 || cell === undefined) continue;
        if (cell === "G") {
          ctx.fillStyle = "#232b3a";
          ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
          ctx.fillStyle = "rgba(255,255,255,0.14)";
          ctx.fillRect(x * size + 2, y * size + 2, size - 4, 3);
          ctx.strokeStyle = "rgba(0,0,0,0.6)";
          ctx.lineWidth = 1;
          ctx.strokeRect(x * size + 0.5, y * size + 0.5, size - 1, size - 1);
          continue;
        }
        const c = COLORS[cell];
        if (flash.has(y)) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(x * size, y * size, size, size);
        } else {
          drawCell(ctx, x, y, size, c.main, c.dark);
        }
      }
    }

    if (active) {
      const shape = SHAPES[active.type][active.rotation];
      const c = COLORS[active.type];
      // ghost
      if (ghostY !== null && ghostY !== active.y) {
        for (let y = 0; y < shape.length; y++)
          for (let x = 0; x < shape[y].length; x++) {
            if (!shape[y][x]) continue;
            const bx = active.x + x;
            const by = ghostY + y - HIDDEN_ROWS;
            if (by < 0) continue;
            drawCell(ctx, bx, by, size, c.main, c.dark, true);
          }
      }
      // active with glow
      ctx.shadowColor = c.glow;
      ctx.shadowBlur = 12;
      for (let y = 0; y < shape.length; y++)
        for (let x = 0; x < shape[y].length; x++) {
          if (!shape[y][x]) continue;
          const bx = active.x + x;
          const by = active.y + y - HIDDEN_ROWS;
          if (by < 0) continue;
          drawCell(ctx, bx, by, size, c.main, c.dark);
        }
      ctx.shadowBlur = 0;
    }
  });

  return (
    <canvas
      ref={ref}
      style={{ width, height }}
      className="block border-2 border-slate-200/90 bg-black shadow-[0_0_30px_rgba(0,0,0,0.6)]"
    />
  );
}
