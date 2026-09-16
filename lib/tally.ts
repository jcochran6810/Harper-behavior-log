/**
 * Deterministic tally counting.
 *
 * The vision model does two separable jobs when it reads a page: TRANSCRIBE the
 * glyphs it can see, and COUNT them. It is good at the first and unreliable at
 * the second — a long run like "11111111" is exactly where a model pads a digit
 * or two, which is how a day gets reported higher than the paper actually says.
 *
 * So we take the arithmetic away from it. The model transcribes verbatim into
 * `raw_tally`; this module counts those glyphs in plain TypeScript. When the two
 * disagree, the transcription wins and the row is flagged for a human — the
 * transcription is the part a person can check against the photo.
 */

import { BEHAVIOR_KEYS, type BehaviorKey } from "./behaviors";

export type TallyCounts = Record<BehaviorKey, number>;

export type TallyReading = {
  counts: TallyCounts;
  /** False when some token in the transcription wasn't a tally we recognise. */
  understood: boolean;
  /** The tokens we couldn't read, for the message shown to the reviewer. */
  unknown: string[];
  /** True when there was nothing to read at all. */
  empty: boolean;
};

export function zeroCounts(): TallyCounts {
  return { b1: 0, b2: 0, b3: 0, b4: 0, b5: 0, b6: 0, b7: 0, b8: 0 };
}

/** Separators the teacher (and the transcription) use between clusters. */
const SEPARATOR = /[\s,;.·•\-–—_/\\+&]+/;

/**
 * A cursive chain of connected loops — the teacher's shorthand for a run of 6s.
 * It has to alternate: a plain run of l's is vertical strokes (behavior 1), not
 * loops, and reading "llll" as 6s would put marks under the wrong behavior.
 */
const LOOP_CHAIN = /^(?:le|el|ec|ce)+$/i;

/** Vertical strokes, however they got transcribed, are behavior 1. */
const STROKES = /^[|ıI¦l1]+$/;

/** A row of S-like glyphs is behavior 5. */
const ESSES = /^[sS5]+$/;

/**
 * Count one whitespace-delimited cluster.
 * Returns null when the cluster isn't a tally we understand.
 */
function readCluster(token: string): { key: BehaviorKey; count: number } | null {
  if (!token) return null;

  // A run of one repeated digit 1-8: "1111" is four 1s, not one thousand.
  if (/^[1-8]+$/.test(token)) {
    const digits = new Set(token.split(""));
    if (digits.size === 1) {
      return { key: `b${token[0]}` as BehaviorKey, count: token.length };
    }
    return null; // mixed digits in one cluster — split below
  }

  if (STROKES.test(token)) return { key: "b1", count: token.length };
  if (LOOP_CHAIN.test(token)) {
    // Each loop-pair is one 6.
    return { key: "b6", count: token.length / 2 };
  }
  if (ESSES.test(token)) return { key: "b5", count: token.length };

  return null;
}

/**
 * Count the behaviors written in a verbatim tally transcription.
 * Clusters of the same digit are summed: "11 66 111" is three 1s in two
 * clusters plus two 6s.
 */
export function readTally(raw: string | null | undefined): TallyReading {
  const counts = zeroCounts();
  const unknown: string[] = [];
  const text = (raw ?? "").trim();

  if (!text) return { counts, understood: true, unknown, empty: true };

  let sawSomething = false;

  for (const token of text.split(SEPARATOR)) {
    if (!token) continue;

    const direct = readCluster(token);
    if (direct) {
      counts[direct.key] += direct.count;
      sawSomething = true;
      continue;
    }

    // "11116666" — several runs written without a space between them.
    if (/^[1-8]+$/.test(token)) {
      for (const run of token.match(/(\d)\1*/g) ?? []) {
        counts[`b${run[0]}` as BehaviorKey] += run.length;
        sawSomething = true;
      }
      continue;
    }

    unknown.push(token.slice(0, 24));
  }

  return { counts, understood: unknown.length === 0, unknown, empty: !sawSomething };
}

export function totalOf(counts: TallyCounts): number {
  return BEHAVIOR_KEYS.reduce((sum, k) => sum + (counts[k] || 0), 0);
}

export function sameCounts(a: TallyCounts, b: TallyCounts): boolean {
  return BEHAVIOR_KEYS.every((k) => (a[k] || 0) === (b[k] || 0));
}

/** Human-readable "1 ×8 → ×6" style description of what changed. */
export function describeDiff(from: TallyCounts, to: TallyCounts): string {
  const parts: string[] = [];
  for (const k of BEHAVIOR_KEYS) {
    const a = from[k] || 0;
    const b = to[k] || 0;
    if (a !== b) parts.push(`${k.slice(1)}: ${a} → ${b}`);
  }
  return parts.join(", ");
}

/** Per-behavior lower of two readings — used when two passes disagree. */
export function lowerOf(a: TallyCounts, b: TallyCounts): TallyCounts {
  const out = zeroCounts();
  for (const k of BEHAVIOR_KEYS) out[k] = Math.min(a[k] || 0, b[k] || 0);
  return out;
}
