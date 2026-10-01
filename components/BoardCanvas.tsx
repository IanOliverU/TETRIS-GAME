"use client";
import { useEffect, useRef } from "react";
import { COLS, ROWS, HIDDEN_ROWS, COLORS, type Cell } from "@/lib/tetris/constants";
import type { ActivePiece } from "@/lib/tetris/engine";
import { SHAPES } from "@/lib/tetris/constants";
import { useTheme, type BlockStyle } from "@/lib/theme";

function drawCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  dark: string,
  style: BlockStyle,
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
  if (style === "flat") {
    ctx.fillStyle = color;
    ctx.fillRect(px + 1, py + 1, size - 2, size - 2);
    ctx.strokeStyle = dark;
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 1.5, py + 1.5, size - 3, size - 3);
    return;
  }
  if (style === "outline") {
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = color;
    ctx.fillRect(px + 1, py + 1, size - 2, size - 2);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, size * 0.1);
    ctx.strokeRect(px + 2, py + 2, size - 4, size - 4);
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
  const { theme, blockStyle } = useTheme();
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

    const styles = getComputedStyle(document.documentElement);
    ctx.fillStyle = styles.getPropertyValue("--board").trim() || "#071321";
    ctx.fillRect(0, 0, width, height);

    if (showGrid) {
      ctx.strokeStyle = styles.getPropertyValue("--board-grid").trim() || "rgba(148,163,184,0.12)";
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
          ctx.fillStyle = "#8b929b";
          ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
          ctx.fillStyle = "#b8bec6";
          ctx.fillRect(x * size + 2, y * size + 2, size - 4, Math.max(2, size * 0.16));
          ctx.strokeStyle = "#343a43";
          ctx.lineWidth = Math.max(1, size * 0.06);
          ctx.strokeRect(x * size + 1, y * size + 1, size - 2, size - 2);
          continue;
        }
        const c = COLORS[cell];
        if (flash.has(y)) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(x * size, y * size, size, size);
        } else {
          drawCell(ctx, x, y, size, c.main, c.dark, blockStyle);
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
            drawCell(ctx, bx, by, size, c.main, c.dark, blockStyle, true);
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
          drawCell(ctx, bx, by, size, c.main, c.dark, blockStyle);
        }
      ctx.shadowBlur = 0;
    }
  }, [board, active, ghostY, clearingRows, width, height, showGrid, size, theme, blockStyle]);

  return (
    <canvas
      ref={ref}
      style={{ width, height }}
      className="game-board block border-2"
    />
  );
}
