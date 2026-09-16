import { BEHAVIOR_KEYS } from "./behaviors";
import { bandFor, type Layout } from "./geometry";
import { sameCounts, zeroCounts, type TallyCounts } from "./tally";

/**
 * Turning one confirmed review into labelled examples.
 *
 * Kept free of database and server-only imports so it can be exercised on plain
 * node by `npm test` — this is the part that decides what a label MEANS, so it
 * is the part worth testing. The writing half lives in lib/training.ts.
 */

export type TrainingSample = {
  log_id: string | null;
  log_date: string;
  period_key: string;
  image_path: string | null;
  box: { left: number; right: number; top: number; bottom: number } | null;
  model_raw_tally: string | null;
  model_counts: TallyCounts;
  model_confidence: string | null;
  human_counts: TallyCounts;
  human_not_observed: boolean;
  corrected: boolean;
  source: "review" | "correction";
};

type CountsLike = Partial<Record<(typeof BEHAVIOR_KEYS)[number], number>> | null | undefined;

export function countsOf(source: CountsLike): TallyCounts {
  const out = zeroCounts();
  for (const key of BEHAVIOR_KEYS) {
    const n = Math.round(Number(source?.[key]));
    out[key] = Number.isFinite(n) && n > 0 ? Math.min(n, 99) : 0;
  }
  return out;
}

/**
 * The crop this sample refers to, frozen at confirm time.
 *
 * Copied rather than referenced because a grid can be realigned later; a stored
 * label has to keep pointing at the pixels the human actually looked at.
 */
export function boxFor(layout: Layout | null, periodKey: string): TrainingSample["box"] {
  const band = bandFor(layout, periodKey);
  if (!band || !layout) return null;
  return { left: layout.left, right: layout.right, top: band.top, bottom: band.bottom };
}

/** One sample per period, marking whether the human changed the machine's answer. */
export function buildSamples(input: {
  log_id: string | null;
  log_date: string;
  image_path: string | null;
  layout: Layout | null;
  source: "review" | "correction";
  rows: {
    period_key: string;
    model_raw_tally?: string | null;
    model_confidence?: string | null;
    model: CountsLike;
    human: CountsLike;
    human_not_observed?: boolean;
  }[];
}): TrainingSample[] {
  return input.rows.map((row) => {
    const model_counts = countsOf(row.model);
    const human_counts = countsOf(row.human);
    return {
      log_id: input.log_id,
      log_date: input.log_date,
      period_key: row.period_key,
      image_path: input.image_path,
      box: boxFor(input.layout, row.period_key),
      model_raw_tally: row.model_raw_tally ?? null,
      model_confidence: row.model_confidence ?? null,
      model_counts,
      human_counts,
      human_not_observed: Boolean(row.human_not_observed),
      corrected: !sameCounts(model_counts, human_counts),
    };
  }).map((s) => ({ ...s, source: input.source }));
}
