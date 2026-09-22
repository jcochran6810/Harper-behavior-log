import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { BEHAVIORS, periodLabel } from "./behaviors";
import type { Confidence, ZoomRead } from "./reconcile";

/**
 * The close-up pass: one crop of one row of the form, one question.
 *
 * The whole-page read has to locate ten rows and count every glyph in all of
 * them from an image where a row is about a hundred pixels tall. This pass gets
 * that row on its own, cut out of the full-resolution photograph, and is asked
 * only to write down the glyphs. Splitting the work that way is the point:
 * nothing here has to decide which row it is looking at, or what the notes mean.
 */

export const ROW_READER_MODEL = "claude-opus-5";

const behaviorLegend = BEHAVIORS.map((b) => `  ${b.code}. ${b.label}`).join("\n");

function systemPrompt(periodKey: string): string {
  return `You are looking at ONE row cut out of a photograph of a paper school behavior log. Your only job is to write down the tally glyphs in this row, exactly as many as are actually there. This becomes part of a child's IEP/ARD record, so a count that is too high does real harm.

This row is "${periodLabel(periodKey)}".

The eight behaviors the teacher records, by number:
${behaviorLegend}

HOW THE MARKS WORK
Behaviors are written as REPEATED GLYPHS, and the count is HOW MANY GLYPHS there are:
  - "1111" is behavior 1, four times. It is not the number one thousand one hundred eleven.
  - "66666" is behavior 6, five times.
  - Vertical strokes — "||||" or "llll" — are behavior 1. Count the strokes.
  - A cursive chain of connected loops — "lelele", "lololo", "ececec" — is a run of 6s.
    Count one 6 per loop pair.
  - "SSS" or a row of S-like glyphs is a run of 5s.
  - Clusters can sit anywhere in the cell, on more than one line. Transcribe every cluster,
    separated by single spaces, e.g. "1111 66666 22".

HOW TO COUNT
  - Count one glyph at a time, in groups of three, touching each one. Do not judge a run by
    how long it looks.
  - Write exactly what you counted. Never round up, never pad a run, never stretch it because
    the cell looks busy or the notes describe a difficult period.
  - Runs longer than about eight identical glyphs are uncommon on this form. If you have
    written one, go back and count it again before answering.
  - If a glyph is smudged, overlapping, or you genuinely cannot tell whether it is one mark or
    two, DO NOT COUNT IT, and set confidence to "medium" or "low". A human checks every row
    you flag, so flagging one costs nothing and guessing costs a great deal.

WHAT IS NOT A TALLY
  - Prose is notes, not marks. "refused to do work", "threw shoes", "3 redirects" are notes.
    Never turn described behavior, or a number written in a sentence, into tally glyphs.
  - Smiley faces are positive markers, not behaviors.
  - Printed text, the period name, times, and the ruled lines of the table are not marks.
  - This crop may include a sliver of the row above or below. Marks that are cut off at the
    very top or bottom edge belong to the neighbouring row — DO NOT COUNT THEM.
  - A row containing only notes and no tally glyphs is correctly transcribed as nothing at
    all. Return null for raw_tally. That is a normal, correct answer.

Call record_row exactly once.`;
}

const ROW_TOOL: Anthropic.Tool = {
  name: "record_row",
  description: "Record the tally glyphs visible in this one row of the behavior log.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      glyph_by_glyph: {
        type: "string",
        description:
          'How you counted, so the count can be checked: list each cluster and its length, e.g. "cluster of 1s: | | | | = 4; cluster of 6s: loop loop loop = 3". Empty string if there are no marks.',
      },
      raw_tally: {
        type: ["string", "null"],
        description:
          'The glyphs, verbatim, clusters separated by single spaces, e.g. "1111 66666 22". Exactly as many characters as there are marks on the page. Null if this row has no tally marks.',
      },
      confidence: {
        type: "string",
        enum: ["high", "medium", "low"],
        description: 'Only "high" when every glyph in the cell was distinct and countable.',
      },
    },
    required: ["glyph_by_glyph", "raw_tally", "confidence"],
  } as unknown as Anthropic.Tool.InputSchema,
};

type RawRow = {
  glyph_by_glyph?: string;
  raw_tally: string | null;
  confidence: string;
};

function asConfidence(value: unknown): Confidence {
  return value === "high" || value === "medium" || value === "low" ? value : "medium";
}

export type RowCrop = {
  period_key: string;
  /** base64 JPEG/PNG of just this row, cut from the full-resolution photo. */
  image: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
};

async function readRow(client: Anthropic, crop: RowCrop): Promise<ZoomRead> {
  const response = await client.messages.create({
    model: ROW_READER_MODEL,
    max_tokens: 2000,
    system: systemPrompt(crop.period_key),
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    tools: [ROW_TOOL],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: crop.mediaType, data: crop.image },
          },
          {
            type: "text",
            text: "Count the tally glyphs in this row one at a time, then call record_row. If there are no tally marks, say so with null.",
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return {
      period_key: crop.period_key,
      raw_tally: null,
      confidence: "low",
      error: "The close-up reader didn't answer for this row.",
    };
  }

  const input = toolUse.input as RawRow;
  return {
    period_key: crop.period_key,
    raw_tally: typeof input.raw_tally === "string" && input.raw_tally.trim()
      ? input.raw_tally.trim().slice(0, 200)
      : null,
    confidence: asConfidence(input.confidence),
  };
}

/**
 * Read every crop. Each row is independent, so one failure costs that row its
 * close-up check and nothing else — the whole-page reading still stands, and
 * `reconcileRow` flags the row so a human knows it went unchecked.
 */
export async function readRowCrops(crops: RowCrop[]): Promise<ZoomRead[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return crops.map((c) => ({
      period_key: c.period_key,
      raw_tally: null,
      confidence: "low" as Confidence,
      error: "No ANTHROPIC_API_KEY is set, so rows can't be double-checked close up.",
    }));
  }

  const client = new Anthropic({ apiKey });

  const settled = await Promise.allSettled(crops.map((crop) => readRow(client, crop)));
  return settled.map((result, i) => {
    if (result.status === "fulfilled") return result.value;
    const reason = result.reason;
    return {
      period_key: crops[i].period_key,
      raw_tally: null,
      confidence: "low" as Confidence,
      error:
        reason instanceof Error
          ? `Close-up check failed: ${reason.message.slice(0, 160)}`
          : "Close-up check failed.",
    };
  });
}
