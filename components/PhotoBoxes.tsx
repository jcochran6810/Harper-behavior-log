"use client";

import { useRef, useState } from "react";
import { BEHAVIORS, periodLabel } from "@/lib/behaviors";
import { rescaleBands, type Layout } from "@/lib/geometry";

/**
 * The photographed page with a tappable box over each row of the form.
 *
 * Tap a box and you land on that row's numbers. The boxes come from the row
 * grid the reader measured, which can be wrong — so "Line up the boxes" gives
 * two handles, one for the top of the first row and one for the bottom of the
 * last. Dragging them rescales every row in between proportionally, which is
 * enough to fix any grid on a flat photograph.
 */
export default function PhotoBoxes({
  src,
  alt,
  layout,
  totals,
  flagged,
  activeKey,
  estimated,
  onPick,
  onLayoutChange,
}: {
  src: string;
  alt: string;
  layout: Layout;
  /** Incidents currently recorded against each period, keyed by period_key. */
  totals: Record<string, number>;
  /** Period keys worth a second look — drawn in amber. */
  flagged?: Set<string>;
  activeKey?: string | null;
  estimated?: boolean;
  onPick: (periodKey: string) => void;
  /** Omit to make the grid read-only (no aligning). */
  onLayoutChange?: (next: Layout) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [aligning, setAligning] = useState(false);
  const [dragging, setDragging] = useState<"top" | "bottom" | null>(null);

  const bands = layout.bands;
  const first = bands[0];
  const last = bands[bands.length - 1];
  if (!first || !last) return null;

  const left = layout.left * 100;
  const width = (layout.right - layout.left) * 100;

  /** Pointer position as a fraction of the image's height. */
  function fractionFromEvent(clientY: number): number {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect || rect.height === 0) return 0;
    return Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
  }

  function moveHandle(which: "top" | "bottom", clientY: number) {
    if (!onLayoutChange) return;
    const at = fractionFromEvent(clientY);
    // Keep the handles apart: crossing them would invert the whole grid.
    const nextTop = which === "top" ? Math.min(at, last.bottom - 0.05) : first.top;
    const nextBottom = which === "bottom" ? Math.max(at, first.top + 0.05) : last.bottom;
    onLayoutChange(rescaleBands(layout, nextTop, nextBottom));
  }

  return (
    <div className="space-y-2">
      <div
        ref={frameRef}
        className="card relative overflow-hidden"
        style={{ background: "var(--page)", touchAction: dragging ? "none" : undefined }}
        onPointerMove={(e) => dragging && moveHandle(dragging, e.clientY)}
        onPointerUp={() => setDragging(null)}
        onPointerCancel={() => setDragging(null)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="block w-full" />

        {bands.map((band) => {
          const total = totals[band.period_key] ?? 0;
          const isFlagged = flagged?.has(band.period_key) ?? false;
          const isActive = activeKey === band.period_key;
          const color = isFlagged ? "var(--warning)" : BEHAVIORS[0].color;
          return (
            <button
              key={band.period_key}
              type="button"
              onClick={() => !aligning && onPick(band.period_key)}
              aria-label={`${periodLabel(band.period_key)} — ${total} incidents. Edit this row.`}
              className="absolute flex items-start justify-between gap-1 rounded px-1 text-left"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                top: `${band.top * 100}%`,
                height: `${(band.bottom - band.top) * 100}%`,
                border: `2px solid ${color}`,
                background: isActive ? `${color}33` : "transparent",
                pointerEvents: aligning ? "none" : undefined,
              }}
            >
              <span
                className="rounded-br px-1 text-[10px] font-medium leading-tight text-white"
                style={{ background: color }}
              >
                {periodLabel(band.period_key)}
              </span>
              {total > 0 && (
                <span
                  className="tnum rounded-bl px-1 text-[10px] font-semibold leading-tight text-white"
                  style={{ background: color }}
                >
                  {total}
                </span>
              )}
            </button>
          );
        })}

        {aligning && onLayoutChange && (
          <>
            {(
              [
                { which: "top" as const, at: first.top, label: "Top of the first row" },
                { which: "bottom" as const, at: last.bottom, label: "Bottom of the last row" },
              ]
            ).map(({ which, at, label }) => (
              <div
                key={which}
                role="slider"
                aria-label={label}
                aria-valuenow={Math.round(at * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                tabIndex={0}
                onPointerDown={(e) => {
                  // Touch sets implicit capture on the handle, which would stop
                  // the frame below from seeing the move events. Mouse never has
                  // it, and releasing what you don't hold throws — hence the try.
                  try {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  } catch {
                    /* no capture to release */
                  }
                  setDragging(which);
                }}
                onKeyDown={(e) => {
                  if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                  e.preventDefault();
                  const step = e.key === "ArrowUp" ? -0.005 : 0.005;
                  const nextTop = which === "top" ? first.top + step : first.top;
                  const nextBottom = which === "bottom" ? last.bottom + step : last.bottom;
                  onLayoutChange(rescaleBands(layout, nextTop, nextBottom));
                }}
                className="absolute flex cursor-ns-resize items-center justify-center"
                style={{
                  left: 0,
                  right: 0,
                  top: `calc(${at * 100}% - 14px)`,
                  height: 28,
                  touchAction: "none",
                }}
              >
                <span className="h-1 w-full" style={{ background: "var(--critical)" }} />
                <span
                  className="absolute rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                  style={{ background: "var(--critical)" }}
                >
                  {which === "top" ? "▲ first row" : "▼ last row"}
                </span>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 text-xs">
        <p style={{ color: "var(--text-muted)" }}>
          {aligning
            ? "Drag the two red bars onto the top of the first row and the bottom of the last."
            : estimated
              ? "⚠ The boxes are a guess — line them up before trusting them."
              : "Tap a box to check or fix that row."}
        </p>
        {onLayoutChange && (
          <button
            type="button"
            onClick={() => setAligning((v) => !v)}
            className="shrink-0 rounded-full border px-3 py-1.5 font-medium"
            style={{
              borderColor: estimated && !aligning ? "var(--warning)" : "var(--border)",
              color: "var(--text-primary)",
            }}
          >
            {aligning ? "Done" : "Line up the boxes"}
          </button>
        )}
      </div>
    </div>
  );
}
