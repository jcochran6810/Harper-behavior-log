import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { BEHAVIORS, BEHAVIOR_KEYS, PERIOD_KEYS, PERIODS } from "./behaviors";
import {
  describeDiff,
  lowerOf,
  readTally,
  sameCounts,
  totalOf,
  zeroCounts,
  type TallyCounts,
} from "./tally";
import {
  averageLayouts,
  fallbackLayout,
  layoutDrift,
  normalizeLayout,
  type Layout,
} from "./geometry";
import type { ParsedLog, PeriodEntry } from "./types";

export const PARSER_MODEL = "claude-opus-5";

/**
 * How many independent reads of the photo to take. Two reads that agree are
 * strong evidence; two that disagree mean the page is genuinely hard to read,
 * and that row gets flagged for a human instead of quietly picking a number.
 * Set PARSER_PASSES=1 to halve the cost at the cost of that cross-check.
 */
function passCount(): number {
  const n = Number(process.env.PARSER_PASSES);
  return Number.isFinite(n) && n >= 1 && n <= 3 ? Math.round(n) : 2;
}

const behaviorLegend = BEHAVIORS.map((b) => `  ${b.code}. ${b.label}`).join("\n");
const periodLegend = PERIODS.map((p) => `  ${p.key} — "${p.label}" (${p.timeRange})`).join("\n");

const SYSTEM_PROMPT = `You read a photograph of one day of a paper school behavior log and transcribe it into structured data. Accuracy matters more than speed: this data is being used to document a child's needs for an IEP/ARD meeting.

THE FORM
A header box lists eight numbered behaviors:
${behaviorLegend}

The header also has a "Date: ___/___" field (frequently left blank) and sometimes a
day-of-week letter (M, T, W, Th, F) scribbled in a corner or margin.

Below the header are exactly ten rows, one per period of the school day, in this order:
${periodLegend}

Each row has a small "antecedent:" field and a large handwritten notes area.

HOW THE TEACHER RECORDS BEHAVIORS — THIS IS THE CRITICAL PART
Behaviors are recorded as REPEATED GLYPHS, and you must COUNT THE GLYPHS rather than
read them as a number.
  - "1111"  means behavior 1 happened FOUR times (it is not one thousand one hundred eleven).
  - "66666" means behavior 6 happened FIVE times.
  - A run of vertical strokes — "||||||" or lowercase "llllll" — is behavior 1. Count the strokes.
  - A cursive chain that looks like "lelelele", "ececec" or a row of connected loops is a run
    of 6s. Count each loop-pair as one 6.
  - "SSS" or a row of S-like glyphs is usually a run of 5s.
  - Runs of the same digit can appear in several separate clusters, on different lines,
    anywhere in the cell. Transcribe every cluster.

YOUR TRANSCRIPTION IS THE ANSWER — THE ARITHMETIC IS NOT YOURS TO DO
For each cell, \`raw_tally\` must be a character-for-character transcription of the tally
glyphs actually on the page, with a space between clusters — for example "1111 66666 22".
Downstream software counts the characters in that string to produce the numbers; a human
then holds it up against the photo. So:
  - Write exactly as many glyphs as you can actually see. Not "about eight" — eight, because
    you counted eight.
  - NEVER round a run up, pad it out, or extend it because the cell "looks busy" or the note
    describes a rough period. Over-reporting a child's behavior in an IEP record is a serious
    error. If you can see six clear marks and suspect a seventh, transcribe six and set
    confidence to "medium".
  - Runs of more than about eight identical glyphs are uncommon. If you have written one,
    go back to the image and re-count it one glyph at a time before committing.
  - Count long runs in groups of three (||| ||| ||) rather than eyeballing the length.
  - The \`counts\` object must match your own \`raw_tally\` exactly: the number of 1s you wrote
    in raw_tally is b1, the number of 6s is b6, and so on. If they disagree, your transcription
    is the one that's right — fix the counts to match it.

OTHER MARKS
  - Smiley faces are POSITIVE markers, not behaviors. Count them in smiley_count.
  - Prose is notes, not tallies. "threw shoes", "was pulled for therapy", "refused to do work"
    are notes — do NOT convert described behavior into tally counts. Only actual written
    tally glyphs produce counts. A cell with a paragraph of notes and no tally marks has
    all-zero counts, and that is a correct reading.
  - A wavy line or strikethrough through the antecedent field is just the teacher crossing
    it out; ignore it.
  - "Not present at lunch/specials to see all behaviors" (or similar) means the teacher could
    not observe that period: set not_observed = true, leave raw_tally null and all counts 0,
    even if there is other writing in the row.
  - The Specials row is sometimes labeled with the actual subject (Library, PE, Music, Art).
    Put that in specials_subject.

TWO COUNTS FOR THE WHOLE DAY, READ OUT OF THE NOTES
Two numbers are counted ONCE FOR THE ENTIRE PAGE, not per row. They may be written in a
box at the top of the form; if they are, read them there and trust that box over your own
reading of the notes. If there is no such box, count the separate occasions described
anywhere in the day's notes, adding them up across all ten rows.

These are the only numbers you may take from prose, and the bar is high: an EXPLICIT
statement that it happened.
  - assistance_count — how many times ANOTHER ADULT WAS CALLED INTO THE ROOM across the
    day. "Called for assistance", "I had to call for support", "admin came down", "the
    support teacher came in", "had to get help". Count occasions, not the number of adults.
  - removed_count — how many times HARPER WAS TAKEN OUT OF THE CLASSROOM across the day.
    "Taken to the office", "walked to the calm room", "sent home", "removed from class",
    "had to leave the room".

What does NOT count:
  - A scheduled or routine departure is not a removal: "was pulled for therapy", "went to
    the nurse", "walked to lunch", "went to specials", "left early" for a known reason,
    a normal restroom trip. Only count leaving the room as a CONSEQUENCE of behavior.
  - One episode is one event. A sentence describing a single incident in two rows, or a
    removal and the return from it, is still one removal.
  - Harper leaving on her own — "ran out of the room", "walked out" — is not a removal.
    It may well be behavior 6 or similar, but nobody removed her.
  - A teacher describing an ordinary redirect, prompt, reminder or negotiation is not
    assistance being called. "3 redirects", "needed reminders", "we talked" are the
    classroom teacher doing her own job, not a second adult arriving.
  - Another adult who was already in the room, or is always in the room, was not called.
  - If the notes are ambiguous about whether it happened, or about how many times, use
    the LOWER number and set confidence to "medium". These figures go into an argument
    about staffing, and an inflated one discredits the whole record.
  - Both are 0 on most days. Zero is the normal answer.

RULES
  - Return all ten periods, in schedule order, even when a row is blank.
  - raw_tally is null when the cell contains no tally glyphs at all.
  - Transcribe notes faithfully into readable prose. Expand obvious shorthand (w/ -> with,
    RR -> restroom) but never invent content.
  - Set confidence to "high" only when you could see every glyph in the cell distinctly.
    Smudged, overlapping, cut off, or ambiguous glyphs mean "medium" or "low" — a human
    re-checks every row you mark, so marking one costs nothing and guessing costs a lot.
  - If the Date field is blank, return null for log_date. Do not substitute today's date.

WHERE EACH ROW SITS ON THE PHOTOGRAPH
Alongside the transcription, report the grid of the printed table so the app can draw a
tappable box over each row. Give every measurement as a FRACTION of the whole image:
0.0 is the left or top edge, 1.0 is the right or bottom edge.
  - table_left / table_right: the vertical ruled lines bounding the table.
  - Each row gets row_top and row_bottom: the horizontal ruled lines above and below THAT
    row, measured down the page. Community Time is the first row under the header box;
    Social Studies is the last.
  - The rows are stacked and touch each other, so one row's bottom is the next row's top.
    They must increase down the page: every row_top is greater than the row above it.
  - Measure the printed ruled lines, not the handwriting — handwriting often spills past
    its row, and a box drawn around the writing would cover the wrong row.
  - Estimate as carefully as you can, but do not agonise: a person can drag the grid into
    place afterwards, and a grid that is obviously wrong is discarded rather than shown.

Call the record_behavior_log tool exactly once with the complete transcription. Do not reply with plain text.`;

const periodSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    period_key: { type: "string", enum: PERIOD_KEYS, description: "Which schedule row this is." },
    specials_subject: {
      type: ["string", "null"],
      description: "For the specials row only: Library, PE, Music, Art, etc. Otherwise null.",
    },
    antecedent: { type: ["string", "null"], description: "Text in the antecedent field, or null." },
    notes: { type: ["string", "null"], description: "The teacher's handwritten notes as prose." },
    raw_tally: {
      type: ["string", "null"],
      description:
        'Character-for-character transcription of the tally glyphs in this cell, clusters separated by spaces, e.g. "1111 66666". Exactly as many glyphs as are on the page. Null if there are none.',
    },
    smiley_count: { type: "integer", description: "How many smiley faces are drawn in this row." },
    not_observed: {
      type: "boolean",
      description: "True when the teacher noted she could not observe this period.",
    },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    row_top: {
      type: "number",
      description: "Fraction of image height (0-1) of the ruled line ABOVE this row.",
    },
    row_bottom: {
      type: "number",
      description: "Fraction of image height (0-1) of the ruled line BELOW this row.",
    },
    counts: {
      type: "object",
      additionalProperties: false,
      description: "Must match raw_tally exactly: how many of each glyph you transcribed.",
      properties: Object.fromEntries(
        BEHAVIORS.map((b) => [`b${b.code}`, { type: "integer", description: b.label }]),
      ),
      required: BEHAVIORS.map((b) => `b${b.code}`),
    },
  },
  required: [
    "period_key", "specials_subject", "antecedent", "notes", "raw_tally",
    "smiley_count", "not_observed", "confidence", "row_top", "row_bottom", "counts",
  ],
} as const;

/**
 * Strict mode guarantees the tool input matches the schema, which is worth
 * having — but it only accepts a subset of JSON Schema, and a keyword it
 * dislikes fails the whole request with a 400 before the photo is ever read.
 * (That is what `minItems: 10` on `periods` used to do.) So the schema is
 * built both ways and a schema rejection retries without strict rather than
 * leaving the user staring at raw API JSON.
 */
function buildTool(strict: boolean): Anthropic.Tool {
  return {
    name: "record_behavior_log",
    description: "Record the transcribed contents of one day's behavior log.",
    ...(strict ? { strict: true } : {}),
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        date_month: { type: ["integer", "null"], description: "Month from the Date field, or null if blank." },
        date_day: { type: ["integer", "null"], description: "Day from the Date field, or null if blank." },
        day_of_week: { type: ["string", "null"], description: "Mon/Tue/Wed/Thu/Fri if written, else null." },
        overall_note: {
          type: ["string", "null"],
          description: "Anything written outside the ten rows — a week heading, a margin note, a scoring key.",
        },
        // No minItems/maxItems here: a strict tool schema only accepts 0 or 1 for
        // minItems, and the API rejects the whole request otherwise. The count is
        // stated in the description, and any row the model skips is filled in as
        // an empty, flagged period below.
        assistance_count: {
          type: "integer",
          description:
            "For the WHOLE DAY: times another adult was called into the room. From the box at the top of the form if there is one, otherwise counted across all the notes. 0 if not described.",
        },
        removed_count: {
          type: "integer",
          description:
            "For the WHOLE DAY: times Harper was taken out of the classroom as a consequence of behavior. Scheduled pull-outs, lunch, specials and her leaving on her own do not count. 0 if not described.",
        },
        table_left: {
          type: "number",
          description: "Fraction of image width (0-1) of the table's left ruled edge.",
        },
        table_right: {
          type: "number",
          description: "Fraction of image width (0-1) of the table's right ruled edge.",
        },
        periods: {
          type: "array",
          items: periodSchema,
          description: "All ten schedule rows, in order, including blank ones.",
        },
      },
      required: [
        "date_month", "date_day", "day_of_week", "overall_note",
        "assistance_count", "removed_count",
        "table_left", "table_right", "periods",
      ],
    } as unknown as Anthropic.Tool.InputSchema,
    };
}

type RawPeriod = {
  period_key: string;
  specials_subject: string | null;
  antecedent: string | null;
  notes: string | null;
  raw_tally: string | null;
  smiley_count: number;
  not_observed: boolean;
  confidence: string;
  row_top: number;
  row_bottom: number;
  counts: Record<string, number>;
};

type RawLog = {
  date_month: number | null;
  date_day: number | null;
  day_of_week: string | null;
  overall_note: string | null;
  assistance_count: number;
  removed_count: number;
  table_left: number;
  table_right: number;
  periods: RawPeriod[];
};

/** Pull the row grid out of one read, or null if it doesn't hold together. */
function layoutOf(read: RawLog): Layout | null {
  return normalizeLayout({
    left: read.table_left,
    right: read.table_right,
    bands: (read.periods ?? []).map((p) => ({
      period_key: p.period_key,
      top: p.row_top,
      bottom: p.row_bottom,
    })),
  });
}

/**
 * Two independent reads that place the same row in noticeably different spots
 * mean neither measurement is trustworthy, so the grid falls back to an even
 * split and asks to be aligned. 4% of the image height is about a third of a
 * row on this form — past that, a box starts covering its neighbour.
 */
const MAX_LAYOUT_DRIFT = 0.04;

function settleLayout(reads: RawLog[]): { layout: Layout; measured: boolean } {
  const found = reads.map(layoutOf).filter((l): l is Layout => l !== null);
  if (found.length === 0) return { layout: fallbackLayout(), measured: false };
  if (found.length === 1) return { layout: found[0], measured: true };

  const [first, second] = found;
  if (layoutDrift(first, second) > MAX_LAYOUT_DRIFT) {
    return { layout: fallbackLayout(), measured: false };
  }
  return { layout: averageLayouts(first, second), measured: true };
}

type Confidence = PeriodEntry["confidence"];

const CONFIDENCE_ORDER: Confidence[] = ["high", "medium", "low"];

function worseOf(a: Confidence, b: Confidence): Confidence {
  return CONFIDENCE_ORDER.indexOf(a) >= CONFIDENCE_ORDER.indexOf(b) ? a : b;
}

function clampCount(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 99);
}

function countsFrom(source: Record<string, number> | undefined): TallyCounts {
  const out = zeroCounts();
  for (const key of BEHAVIOR_KEYS) out[key] = clampCount(source?.[key]);
  return out;
}

/** Turn the model's month/day into a full date, choosing the most recent school year. */
function resolveDate(month: number | null, day: number | null): string | null {
  if (!month || !day || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const today = new Date();
  let year = today.getFullYear();
  // A log dated later than today is almost certainly from last calendar year
  // (e.g. a December log opened in January).
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getTime() > today.getTime() + 86_400_000) year -= 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function emptyPeriod(key: string): PeriodEntry {
  return {
    period_key: key,
    specials_subject: null,
    antecedent: null,
    notes: null,
    raw_tally: null,
    smiley_count: 0,
    not_observed: false,
    confidence: "low",
    b1: 0, b2: 0, b3: 0, b4: 0, b5: 0, b6: 0, b7: 0, b8: 0,
    flags: ["This row wasn't returned by the reader — check it against the photo."],
  };
}

/**
 * One pass, one period: settle on the numbers for this cell.
 *
 * The transcription is the evidence; the model's own counts are its arithmetic
 * over that evidence. Where they disagree the transcription wins, because that's
 * the part a person can verify by looking at the photo.
 */
function settlePeriod(p: RawPeriod): {
  counts: TallyCounts;
  confidence: Confidence;
  flags: string[];
} {
  const flags: string[] = [];
  const modelCounts = countsFrom(p.counts);
  let confidence: Confidence = CONFIDENCE_ORDER.includes(p.confidence as Confidence)
    ? (p.confidence as Confidence)
    : "medium";

  if (p.not_observed) {
    if (totalOf(modelCounts) > 0) {
      flags.push(
        "Marked “couldn't observe this period” but counts were read too — the counts were cleared. Check the photo.",
      );
      confidence = "low";
    }
    return { counts: zeroCounts(), confidence, flags };
  }

  const reading = readTally(p.raw_tally);

  if (reading.empty) {
    if (totalOf(modelCounts) > 0) {
      // Counts with nothing transcribed means the numbers came from somewhere
      // other than marks on the page — most often the prose notes.
      flags.push(
        "Counted behaviors but transcribed no tally marks. Numbers may have come from the notes rather than the page.",
      );
      confidence = "low";
    }
    return { counts: modelCounts, confidence, flags };
  }

  if (!reading.understood) {
    flags.push(
      `Part of the marks couldn't be counted automatically (${reading.unknown.join(" ")}). Check this row.`,
    );
    return { counts: modelCounts, confidence: "low", flags };
  }

  if (!sameCounts(modelCounts, reading.counts)) {
    flags.push(
      `The reader's numbers didn't match the marks it transcribed — counted the marks instead (${describeDiff(
        modelCounts,
        reading.counts,
      )}).`,
    );
    confidence = "low";
  }

  return { counts: reading.counts, confidence, flags };
}

/** True when a 400 is the API rejecting our tool schema rather than the photo. */
function isSchemaRejection(err: unknown): boolean {
  if (!(err instanceof Anthropic.APIError) || err.status !== 400) return false;
  return /tools\.\d+|input_schema|schema/i.test(err.message);
}

async function requestRead(
  client: Anthropic,
  base64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp",
  strict: boolean,
): Promise<RawLog> {
  const response = await client.messages.create({
    model: PARSER_MODEL,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    tools: [buildTool(strict)],
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          {
            type: "text",
            text: "Transcribe this behavior log. For every cell, write down the tally glyphs exactly as they appear — count them in groups of three, do not pad a run — then call record_behavior_log once.",
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    const text = response.content.find((b) => b.type === "text");
    throw new Error(
      text && text.type === "text"
        ? `Couldn't read that photo: ${text.text.slice(0, 300)}`
        : "Couldn't read that photo. Try retaking it with the whole page in frame and good light.",
    );
  }
  return toolUse.input as RawLog;
}

async function readOnce(
  client: Anthropic,
  base64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp",
): Promise<RawLog> {
  try {
    return await requestRead(client, base64, mediaType, true);
  } catch (err) {
    if (!isSchemaRejection(err)) throw err;
    // Strict validation refused the schema, not the photo. Read it anyway.
    return requestRead(client, base64, mediaType, false);
  }
}

/** Turn an SDK error into something a parent reading it on a phone can act on. */
function friendlyError(err: unknown): Error {
  if (!(err instanceof Anthropic.APIError)) {
    return err instanceof Error ? err : new Error("Couldn't read that photo.");
  }
  if (err.status === 401 || err.status === 403) {
    return new Error(
      "The Anthropic API key was rejected, so photos can't be read. Check ANTHROPIC_API_KEY in Vercel, or use “Enter by hand” below.",
    );
  }
  if (err.status === 429) {
    return new Error("The handwriting reader is rate-limited right now. Wait a minute and try again.");
  }
  if (err.status === 400) {
    return new Error(
      `The reader rejected this request. That's a bug in the app, not your photo — you can still use “Enter by hand” below. (${err.message.slice(0, 200)})`,
    );
  }
  if (err.status && err.status >= 500) {
    return new Error("The handwriting reader is having trouble. Try again in a moment.");
  }
  return new Error(`Couldn't read that photo: ${err.message.slice(0, 200)}`);
}

export async function parseLogImage(
  base64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp",
): Promise<{ parsed: ParsedLog; raw: unknown }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "No ANTHROPIC_API_KEY is set, so photos can't be read yet. Add the key in Vercel → Settings → Environment Variables, or use “Enter by hand” below.",
    );
  }

  const client = new Anthropic({ apiKey });
  const wanted = passCount();

  // Independent reads of the same photo. The first must succeed; the extra ones
  // are a cross-check, so a failure there degrades to a single read rather than
  // failing the upload.
  const settled = await Promise.allSettled(
    Array.from({ length: wanted }, () => readOnce(client, base64, mediaType)),
  );
  const reads = settled
    .filter((r): r is PromiseFulfilledResult<RawLog> => r.status === "fulfilled")
    .map((r) => r.value);

  if (reads.length === 0) {
    const firstRejection = settled.find((r) => r.status === "rejected");
    throw friendlyError(
      firstRejection && firstRejection.status === "rejected" ? firstRejection.reason : undefined,
    );
  }

  const primary = reads[0];
  const others = reads.slice(1);
  const singleRead = wanted > 1 && others.length === 0;

  const byKey = reads.map((read) => {
    const map = new Map<string, RawPeriod>();
    for (const p of read.periods ?? []) map.set(p.period_key, p);
    return map;
  });

  // Always emit all ten rows in schedule order, even if a read skipped one.
  const periods: PeriodEntry[] = PERIOD_KEYS.map((key) => {
    const p = byKey[0].get(key);
    if (!p) return emptyPeriod(key);

    const first = settlePeriod(p);
    let counts = first.counts;
    let confidence = first.confidence;
    const flags = [...first.flags];

    for (let i = 0; i < others.length; i++) {
      const alt = byKey[i + 1].get(key);
      if (!alt) continue;
      const second = settlePeriod(alt);
      if (sameCounts(counts, second.counts)) {
        confidence = worseOf(confidence, second.confidence);
        continue;
      }
      // Two careful reads of the same cell disagreed. Take the lower of the two
      // — an IEP record should never overstate — and send a human to the photo.
      const merged = lowerOf(counts, second.counts);
      flags.push(
        `Two readings of this row disagreed (${totalOf(counts)} vs ${totalOf(
          second.counts,
        )} marks) — kept the lower count. Please check it against the photo.`,
      );
      counts = merged;
      confidence = "low";
    }

    if (singleRead) {
      flags.push("Only one reading of this photo succeeded, so there was no second opinion.");
      confidence = worseOf(confidence, "medium");
    }

    return {
      period_key: key,
      specials_subject: p.specials_subject || null,
      antecedent: p.antecedent || null,
      notes: p.notes || null,
      raw_tally: p.raw_tally || null,
      smiley_count: clampCount(p.smiley_count),
      not_observed: Boolean(p.not_observed),
      confidence,
      b1: counts.b1, b2: counts.b2, b3: counts.b3, b4: counts.b4,
      b5: counts.b5, b6: counts.b6, b7: counts.b7, b8: counts.b8,
      flags,
    };
  });

  const { layout, measured } = settleLayout(reads);

  // The two day-level counts settle the same way the tallies do: where the reads
  // disagree, keep the lower. Reading "called for assistance" out of a sentence is
  // a judgement rather than a measurement, so it errs downwards too — and because
  // it came from prose, any non-zero value is always put in front of a human.
  const assistance = reads.reduce((lowest, r) => Math.min(lowest, clampCount(r.assistance_count)), 99);
  const removed = reads.reduce((lowest, r) => Math.min(lowest, clampCount(r.removed_count)), 99);

  const supportFlags: string[] = [];
  if (assistance > 0 || removed > 0) {
    const parts: string[] = [];
    if (assistance > 0) parts.push(`assistance called ${assistance}×`);
    if (removed > 0) parts.push(`removed from class ${removed}×`);
    supportFlags.push(
      `Read out of the teacher's words, not off the tally marks: ${parts.join(" and ")}. ` +
        `Check it against the page before saving.`,
    );
  }
  if (reads.length > 1) {
    const spread = reads.map((r) => clampCount(r.assistance_count) + clampCount(r.removed_count));
    if (Math.min(...spread) !== Math.max(...spread)) {
      supportFlags.push("The two readings of the page disagreed about these — kept the lower.");
    }
  }

  return {
    parsed: {
      log_date: resolveDate(primary.date_month, primary.date_day),
      day_of_week: primary.day_of_week || null,
      overall_note: primary.overall_note || null,
      periods,
      layout,
      layout_source: measured ? "measured" : "estimated",
      assistance_count: assistance,
      removed_count: removed,
      support_flags: supportFlags,
    },
    raw: { passes: reads.length, reads },
  };
}
