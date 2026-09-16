/**
 * Where each row of the form sits on the photograph.
 *
 * The point of this is the tap targets drawn over the picture: tap the band
 * covering "Reading" and you edit Reading. That only works if the band really
 * is over Reading, so the geometry is treated as a *claim to be checked*, never
 * as fact.
 *
 * Two deliberate choices keep it honest:
 *
 * 1. The model is asked for a ROW GRID, not free-form boxes. The form is a
 *    fixed ten-row printed table, so a row is fully described by a top and a
 *    bottom. That is a one-dimensional question, which a vision model answers
 *    far more reliably than "draw me a rectangle" — and it is cheap to
 *    validate: ten bands, in order, ascending, not overlapping.
 * 2. Anything that fails validation is thrown away for an even split, and the
 *    grid can always be dragged into place by hand. A wrong box is worse than
 *    no box, because it puts a correct-looking edit on the wrong period.
 *
 * All coordinates are fractions of the image (0 = left/top edge, 1 = right/
 * bottom edge), so they survive any resize, thumbnail or zoom.
 */

import { PERIOD_KEYS } from "./behaviors";

export type Band = {
  period_key: string;
  /** Fraction of image height where this row starts. */
  top: number;
  /** Fraction of image height where this row ends. */
  bottom: number;
};

export type Layout = {
  /** Fraction of image width where the table's left edge sits. */
  left: number;
  /** Fraction of image width where the table's right edge sits. */
  right: number;
  bands: Band[];
};

/** Smallest believable row height, as a fraction of the image. */
const MIN_BAND = 0.01;
/** A table narrower than this is a misread, not a table. */
const MIN_WIDTH = 0.2;

function frac(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < 0 || n > 1) return null;
  return n;
}

/**
 * Ten evenly divided rows over the given vertical span.
 *
 * Used when the model's grid doesn't survive validation, and as the starting
 * point for aligning by hand. The default span skips the top quarter of the
 * page, which is where the printed behavior legend sits.
 */
export function fallbackLayout(top = 0.26, bottom = 0.99): Layout {
  const height = (bottom - top) / PERIOD_KEYS.length;
  return {
    left: 0.02,
    right: 0.98,
    bands: PERIOD_KEYS.map((period_key, i) => ({
      period_key,
      top: top + i * height,
      bottom: top + (i + 1) * height,
    })),
  };
}

/**
 * Validate a claimed grid, or reject it.
 *
 * Returns null rather than repairing a bad grid: a grid that needs repair is
 * one we can't trust to be over the right rows, and an even split at least
 * fails predictably.
 */
export function normalizeLayout(raw: unknown): Layout | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as { left?: unknown; right?: unknown; bands?: unknown };

  const left = frac(input.left);
  const right = frac(input.right);
  if (left === null || right === null || right - left < MIN_WIDTH) return null;

  if (!Array.isArray(input.bands)) return null;

  const byKey = new Map<string, { top: number; bottom: number }>();
  for (const entry of input.bands) {
    if (!entry || typeof entry !== "object") continue;
    const b = entry as { period_key?: unknown; top?: unknown; bottom?: unknown };
    const key = String(b.period_key ?? "");
    if (!PERIOD_KEYS.includes(key) || byKey.has(key)) continue;
    const top = frac(b.top);
    const bottom = frac(b.bottom);
    if (top === null || bottom === null || bottom - top < MIN_BAND) continue;
    byKey.set(key, { top, bottom });
  }

  // Every row must be present: a grid missing rows can't be trusted to have
  // the remaining ones in the right places either.
  if (byKey.size !== PERIOD_KEYS.length) return null;

  const bands: Band[] = PERIOD_KEYS.map((period_key) => ({
    period_key,
    ...byKey.get(period_key)!,
  }));

  // Rows must run down the page in schedule order, without overlapping. A grid
  // that doesn't is one where the model has mixed rows up.
  for (let i = 1; i < bands.length; i++) {
    if (bands[i].top < bands[i - 1].bottom - MIN_BAND) return null;
    if (bands[i].top < bands[i - 1].top) return null;
  }

  return { left, right, bands };
}

/**
 * Slide and stretch a grid to a new top and bottom, keeping each row's share of
 * the height. This is what the two drag handles do: line up the first and last
 * rows and every row between them lands correctly.
 */
export function rescaleBands(layout: Layout, top: number, bottom: number): Layout {
  const first = layout.bands[0];
  const last = layout.bands[layout.bands.length - 1];
  if (!first || !last) return layout;

  const oldTop = first.top;
  const oldSpan = last.bottom - oldTop;
  const newSpan = bottom - top;
  if (oldSpan <= 0 || newSpan <= 0) return layout;

  const scale = newSpan / oldSpan;
  return {
    ...layout,
    bands: layout.bands.map((b) => ({
      period_key: b.period_key,
      top: top + (b.top - oldTop) * scale,
      bottom: top + (b.bottom - oldTop) * scale,
    })),
  };
}

/** Average of two grids, used when two reads of the photo both produced one. */
export function averageLayouts(a: Layout, b: Layout): Layout {
  const byKey = new Map(b.bands.map((band) => [band.period_key, band]));
  return {
    left: (a.left + b.left) / 2,
    right: (a.right + b.right) / 2,
    bands: a.bands.map((band) => {
      const other = byKey.get(band.period_key);
      if (!other) return band;
      return {
        period_key: band.period_key,
        top: (band.top + other.top) / 2,
        bottom: (band.bottom + other.bottom) / 2,
      };
    }),
  };
}

/**
 * How far apart two grids are, as the largest disagreement about any single row
 * edge. Two independent reads that place a row in noticeably different places
 * mean neither should be trusted, so the caller falls back.
 */
export function layoutDrift(a: Layout, b: Layout): number {
  const byKey = new Map(b.bands.map((band) => [band.period_key, band]));
  let worst = 0;
  for (const band of a.bands) {
    const other = byKey.get(band.period_key);
    if (!other) return 1;
    worst = Math.max(worst, Math.abs(band.top - other.top), Math.abs(band.bottom - other.bottom));
  }
  return worst;
}

export function bandFor(layout: Layout | null, periodKey: string): Band | null {
  return layout?.bands.find((b) => b.period_key === periodKey) ?? null;
}
