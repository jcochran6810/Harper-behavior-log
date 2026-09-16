import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { BEHAVIORS, PERIOD_KEYS, PERIODS } from "./behaviors";
import type { ParsedLog, PeriodEntry } from "./types";

export const PARSER_MODEL = "claude-opus-5";

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
    anywhere in the cell. Sum every cluster of the same digit into one total for that behavior.
  - Count carefully. Zoom in mentally on each cluster and count one glyph at a time.
    A miscount of one is a real error in this data.

OTHER MARKS
  - Smiley faces are POSITIVE markers, not behaviors. Count them in smiley_count.
  - Prose is notes, not tallies. "threw shoes", "was pulled for therapy", "refused to do work"
    are notes — do NOT convert described behavior into tally counts. Only actual written
    tally glyphs produce counts.
  - A wavy line or strikethrough through the antecedent field is just the teacher crossing
    it out; ignore it.
  - "Not present at lunch/specials to see all behaviors" (or similar) means the teacher could
    not observe that period: set not_observed = true and leave all counts at 0.
  - The Specials row is sometimes labeled with the actual subject (Library, PE, Music, Art).
    Put that in specials_subject.

RULES
  - Return all ten periods, in schedule order, even when a row is blank.
  - raw_tally must be your verbatim transcription of the tally glyphs you see in that cell
    (e.g. "1111  66666"), or null if there are none. A human checks your counts against this.
  - Transcribe notes faithfully into readable prose. Expand obvious shorthand (w/ -> with,
    RR -> restroom) but never invent content.
  - If a cell is smudged, cut off, or you are genuinely unsure of a count, set
    confidence to "low" or "medium" and give your best reading. Never silently guess at "high".
  - If the Date field is blank, return null for log_date. Do not substitute today's date.

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
      description: 'Verbatim tally glyphs seen in this cell, e.g. "1111  66666". Null if none.',
    },
    smiley_count: { type: "integer", description: "How many smiley faces are drawn in this row." },
    not_observed: {
      type: "boolean",
      description: "True when the teacher noted she could not observe this period.",
    },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    counts: {
      type: "object",
      additionalProperties: false,
      description: "How many times each numbered behavior was tallied in this period.",
      properties: Object.fromEntries(
        BEHAVIORS.map((b) => [`b${b.code}`, { type: "integer", description: b.label }]),
      ),
      required: BEHAVIORS.map((b) => `b${b.code}`),
    },
  },
  required: [
    "period_key", "specials_subject", "antecedent", "notes", "raw_tally",
    "smiley_count", "not_observed", "confidence", "counts",
  ],
} as const;

const TOOL: Anthropic.Tool = {
  name: "record_behavior_log",
  description: "Record the transcribed contents of one day's behavior log.",
  strict: true,
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
      periods: { type: "array", items: periodSchema, minItems: 10, maxItems: 10 },
    },
    required: ["date_month", "date_day", "day_of_week", "overall_note", "periods"],
  } as unknown as Anthropic.Tool.InputSchema,
};

type RawPeriod = {
  period_key: string;
  specials_subject: string | null;
  antecedent: string | null;
  notes: string | null;
  raw_tally: string | null;
  smiley_count: number;
  not_observed: boolean;
  confidence: string;
  counts: Record<string, number>;
};

function clampCount(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 99);
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
  };
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
  const response = await client.messages.create({
    model: PARSER_MODEL,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    tools: [TOOL],
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          {
            type: "text",
            text: "Transcribe this behavior log. Count every tally glyph carefully, then call record_behavior_log once.",
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

  const raw = toolUse.input as {
    date_month: number | null;
    date_day: number | null;
    day_of_week: string | null;
    overall_note: string | null;
    periods: RawPeriod[];
  };

  const byKey = new Map<string, RawPeriod>();
  for (const p of raw.periods ?? []) byKey.set(p.period_key, p);

  // Always emit all ten rows in schedule order, even if the model skipped one.
  const periods: PeriodEntry[] = PERIOD_KEYS.map((key) => {
    const p = byKey.get(key);
    if (!p) return emptyPeriod(key);
    const counts = p.counts ?? {};
    return {
      period_key: key,
      specials_subject: p.specials_subject || null,
      antecedent: p.antecedent || null,
      notes: p.notes || null,
      raw_tally: p.raw_tally || null,
      smiley_count: clampCount(p.smiley_count),
      not_observed: Boolean(p.not_observed),
      confidence: (["high", "medium", "low"] as const).includes(p.confidence as "high")
        ? (p.confidence as PeriodEntry["confidence"])
        : "medium",
      b1: clampCount(counts.b1), b2: clampCount(counts.b2),
      b3: clampCount(counts.b3), b4: clampCount(counts.b4),
      b5: clampCount(counts.b5), b6: clampCount(counts.b6),
      b7: clampCount(counts.b7), b8: clampCount(counts.b8),
    };
  });

  return {
    parsed: {
      log_date: resolveDate(raw.date_month, raw.date_day),
      day_of_week: raw.day_of_week || null,
      overall_note: raw.overall_note || null,
      periods,
    },
    raw: toolUse.input,
  };
}
