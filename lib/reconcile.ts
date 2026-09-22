/**
 * Reconciling the whole-page reading of a row against a close-up reading of it.
 *
 * Reading ten rows off one 1568px photograph asks the model to do two hard
 * things at once: find the row, and count the glyphs in it. A row on that image
 * is barely a hundred pixels tall, which is exactly where "seven marks" becomes
 * "eight". The second stage crops each row out of the full-resolution original
 * and asks one question about one cell — how many glyphs are here — which is
 * the question the model is actually good at.
 *
 * Two rules keep the second stage from making things worse:
 *
 * 1. THE CLOSE-UP CAN CONFIRM OR LOWER A COUNT, NEVER RAISE ONE. A crop can
 *    catch the edge of the row above or below, so "the close-up saw more marks"
 *    is at least as likely to be a cropping error as a missed mark — and
 *    over-reporting a child's behavior in an IEP record is the error that
 *    actually costs something. When the close-up reads higher we keep the lower
 *    number and flag the row for a human.
 * 2. COUNTS ALWAYS COME FROM ONE TRANSCRIPTION. The whole app relies on the
 *    stored numbers matching the stored marks — that invariant is what lets a
 *    person check a number against the photo, and what drives "use the count
 *    from the marks". So a row takes its counts AND its transcription from
 *    whichever reading won; the losing transcription goes into the flag text so
 *    the reviewer can see both.
 */

import { BEHAVIOR_KEYS } from "./behaviors";
import { describeDiff, readTally, sameCounts, totalOf, type TallyCounts } from "./tally";

export type Confidence = "high" | "medium" | "low";

const CONFIDENCE_ORDER: Confidence[] = ["high", "medium", "low"];

export function worseOf(a: Confidence, b: Confidence): Confidence {
  return CONFIDENCE_ORDER.indexOf(a) >= CONFIDENCE_ORDER.indexOf(b) ? a : b;
}

/** A row as the whole-page read left it. */
export type PageRow = {
  period_key: string;
  raw_tally: string | null;
  not_observed: boolean;
  confidence: Confidence;
  counts: TallyCounts;
};

/** What the close-up of one row came back with. */
export type ZoomRead = {
  period_key: string;
  /** Verbatim glyphs from the crop, or null if there were none. */
  raw_tally: string | null;
  confidence: Confidence;
  /** Set when the crop couldn't be read at all — the page reading then stands. */
  error?: string | null;
};

export type RowOutcome = {
  counts: TallyCounts;
  raw_tally: string | null;
  confidence: Confidence;
  flags: string[];
  /** Which reading the stored numbers came from, for the review screen. */
  source: "page" | "close-up";
};

/**
 * Settle one row. `zoom` is null when no close-up was taken of it (a row the
 * teacher couldn't observe, a row with nothing in it, or a photo whose row grid
 * wasn't trustworthy enough to crop from).
 */
export function reconcileRow(page: PageRow, zoom: ZoomRead | null): RowOutcome {
  const pageCounts = page.counts;

  // A period nobody could watch has no counts to argue about.
  if (page.not_observed) {
    return {
      counts: pageCounts,
      raw_tally: page.raw_tally,
      confidence: page.confidence,
      flags: [],
      source: "page",
    };
  }

  if (!zoom) {
    return {
      counts: pageCounts,
      raw_tally: page.raw_tally,
      confidence: page.confidence,
      flags: [],
      source: "page",
    };
  }

  if (zoom.error) {
    return {
      counts: pageCounts,
      raw_tally: page.raw_tally,
      confidence: worseOf(page.confidence, "medium"),
      flags: ["The close-up check of this row didn't complete, so only the whole-page reading counted."],
      source: "page",
    };
  }

  const zoomReading = readTally(zoom.raw_tally);

  if (!zoomReading.understood) {
    return {
      counts: pageCounts,
      raw_tally: page.raw_tally,
      confidence: "low",
      flags: [
        `The close-up of this row produced marks that couldn't be counted (${zoomReading.unknown.join(
          " ",
        )}). Kept the whole-page reading — please check this row.`,
      ],
      source: "page",
    };
  }

  const pageTotal = totalOf(pageCounts);

  // An empty close-up over a row that the page said had marks is a suspicious
  // pair: far more often the box is over the wrong part of the page than the
  // marks aren't there. Zeroing a real row on a cropping error would look like
  // the app losing data, so the page reading stands and a human is sent to it.
  if (zoomReading.empty) {
    if (pageTotal === 0) {
      return {
        counts: pageCounts,
        raw_tally: page.raw_tally,
        confidence: worseOf(page.confidence, zoom.confidence),
        flags: [],
        source: "page",
      };
    }
    return {
      counts: pageCounts,
      raw_tally: page.raw_tally,
      confidence: "low",
      flags: [
        "The close-up of this row showed no tally marks, but the whole-page reading found " +
          `${pageTotal}. The box may be over the wrong part of the page — check this row against the photo.`,
      ],
      source: "page",
    };
  }

  if (sameCounts(pageCounts, zoomReading.counts)) {
    // Two looks at the same cell, one of them zoomed in, agreed on every count.
    return {
      counts: pageCounts,
      raw_tally: page.raw_tally,
      confidence: worseOf(page.confidence, zoom.confidence),
      flags: [],
      source: "page",
    };
  }

  const zoomTotal = totalOf(zoomReading.counts);

  // The close-up read FEWER marks: it had the better view, and lower is the
  // safe direction for a record like this one. Its transcription comes with it,
  // so the stored numbers still match the stored marks.
  if (zoomTotal <= pageTotal) {
    return {
      counts: zoomReading.counts,
      raw_tally: zoom.raw_tally,
      confidence: "low",
      flags: [
        `Reading this row close up found fewer marks than reading the whole page did ` +
          `(${pageTotal} → ${zoomTotal}; ${describeDiff(pageCounts, zoomReading.counts)}). ` +
          `Took the close-up count. The whole-page reading was “${page.raw_tally ?? ""}”.`,
      ],
      source: "close-up",
    };
  }

  // The close-up read MORE. That is not allowed to raise the number — a crop
  // can catch the row above or below, and this record must never overstate.
  return {
    counts: pageCounts,
    raw_tally: page.raw_tally,
    confidence: "low",
    flags: [
      `Reading this row close up found more marks than reading the whole page did ` +
        `(${pageTotal} vs ${zoomTotal}). Kept the lower number. The close-up read ` +
        `“${zoom.raw_tally ?? ""}” — check this row against the photo.`,
    ],
    source: "page",
  };
}

/** Which rows are worth taking a close-up of: the ones where a number could be wrong. */
export function rowsWorthZooming(rows: PageRow[]): string[] {
  return rows
    .filter((r) => !r.not_observed)
    .filter((r) => Boolean(r.raw_tally?.trim()) || totalOf(r.counts) > 0)
    .map((r) => r.period_key);
}

export function countsFromRow(row: Record<string, number | null | undefined>): TallyCounts {
  const out = {} as TallyCounts;
  for (const k of BEHAVIOR_KEYS) out[k] = Number(row[k] ?? 0) || 0;
  return out;
}
