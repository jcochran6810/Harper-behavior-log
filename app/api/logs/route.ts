import { NextResponse } from "next/server";
import { db, PHOTO_BUCKET } from "@/lib/supabase";
import { PERIOD_KEYS } from "@/lib/behaviors";
import { normalizeLayout } from "@/lib/geometry";
import { PARSER_MODEL } from "@/lib/parse";
import { buildSamples, recordSamples } from "@/lib/training";
import type { PeriodEntry } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type SaveBody = {
  log_date?: string;
  day_of_week?: string | null;
  overall_note?: string | null;
  date_confirmed?: boolean;
  /** Once for the whole day, not per period — see SUPPORT_EVENTS. */
  assistance_count?: number;
  removed_count?: number;
  /** The reviewer ticked "these two are right". Never inferred. */
  support_confirmed?: boolean;
  periods?: PeriodEntry[];
  image?: string | null;
  mediaType?: string | null;
  raw?: unknown;
  replace?: boolean;
  layout?: unknown;
  /** The periods exactly as the reader produced them, before any human edit. */
  model_periods?: PeriodEntry[];
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function clean(value: unknown, max = 4000): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function count(value: unknown): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 99) : 0;
}

export async function POST(request: Request) {
  let body: SaveBody;
  try {
    body = (await request.json()) as SaveBody;
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const logDate = String(body.log_date ?? "");
  if (!DATE_RE.test(logDate)) {
    return NextResponse.json({ error: "Pick a date for this log." }, { status: 400 });
  }

  const supabase = db();

  const { data: existing } = await supabase
    .from("harper_daily_logs")
    .select("id, image_path")
    .eq("log_date", logDate)
    .maybeSingle();

  if (existing && !body.replace) {
    return NextResponse.json(
      { error: "duplicate", message: `There's already a log saved for ${logDate}.`, id: existing.id },
      { status: 409 },
    );
  }

  // Upload the photo first: if storage fails we haven't written half a log.
  let imagePath: string | null = existing?.image_path ?? null;
  if (body.image && typeof body.image === "string") {
    const mediaType = body.mediaType === "image/png" ? "image/png" : "image/jpeg";
    const ext = mediaType === "image/png" ? "png" : "jpg";
    const path = `${logDate}-${Date.now()}.${ext}`;
    const bytes = Buffer.from(body.image, "base64");
    const { error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, bytes, { contentType: mediaType, upsert: true });
    if (error) {
      return NextResponse.json(
        { error: `Couldn't save the photo: ${error.message}` },
        { status: 500 },
      );
    }
    imagePath = path;
  }

  const logRow = {
    log_date: logDate,
    day_of_week: clean(body.day_of_week, 12),
    overall_note: clean(body.overall_note),
    date_confirmed: body.date_confirmed !== false,
    // Counted once for the day, and never added to an incident total.
    assistance_count: count(body.assistance_count),
    removed_count: count(body.removed_count),
    // Only ever set from an explicit tick on the review screen — saving a log is
    // not by itself a statement about these two, which come from prose.
    support_confirmed_at: body.support_confirmed === true ? new Date().toISOString() : null,
    image_path: imagePath,
    // Only a grid that passes validation is stored; a bad one would put boxes
    // over the wrong rows, and an even split is the safer default.
    row_geometry: (normalizeLayout(body.layout) ?? null) as never,
    raw_parse: (body.raw ?? null) as never,
    parsed_by: body.raw ? PARSER_MODEL : "manual",
    // Nothing reaches this route until a human has read every number on the
    // review screen with the page in front of them, so a saved day is a checked
    // day. The five September logs, transcribed before the app existed, are the
    // only ones that stay unverified — which is exactly the truth about them.
    verified_at: new Date().toISOString(),
    verified_note: body.raw
      ? "Confirmed row by row on the review screen."
      : "Entered by hand from the paper log.",
    updated_at: new Date().toISOString(),
  };

  const { data: saved, error: saveError } = await supabase
    .from("harper_daily_logs")
    .upsert(logRow, { onConflict: "log_date" })
    .select("id")
    .single();

  if (saveError || !saved) {
    return NextResponse.json(
      { error: saveError?.message ?? "Couldn't save this log." },
      { status: 500 },
    );
  }

  // Replace the day's periods wholesale — simpler and always consistent.
  await supabase.from("harper_log_periods").delete().eq("log_id", saved.id);

  const incoming = Array.isArray(body.periods) ? body.periods : [];
  const rows = PERIOD_KEYS.map((key) => {
    const p = incoming.find((entry) => entry?.period_key === key);
    return {
      log_id: saved.id,
      period_key: key,
      specials_subject: clean(p?.specials_subject, 60),
      antecedent: clean(p?.antecedent, 200),
      notes: clean(p?.notes),
      raw_tally: clean(p?.raw_tally, 200),
      smiley_count: count(p?.smiley_count),
      not_observed: Boolean(p?.not_observed),
      confidence: ["high", "medium", "low"].includes(String(p?.confidence))
        ? String(p?.confidence)
        : "high",
      b1: count(p?.b1), b2: count(p?.b2), b3: count(p?.b3), b4: count(p?.b4),
      b5: count(p?.b5), b6: count(p?.b6), b7: count(p?.b7), b8: count(p?.b8),
    };
  });

  const { error: periodError } = await supabase.from("harper_log_periods").insert(rows);
  if (periodError) {
    return NextResponse.json({ error: periodError.message }, { status: 500 });
  }

  // A confirmed review is a labelled example: what the reader said about each
  // cell, next to what a human agreed it was. Only recorded when there was a
  // machine reading to compare against — a log typed in by hand teaches nothing.
  const modelPeriods = Array.isArray(body.model_periods) ? body.model_periods : [];
  if (modelPeriods.length > 0) {
    await recordSamples(
      buildSamples({
        log_id: saved.id,
        log_date: logDate,
        image_path: imagePath,
        layout: normalizeLayout(body.layout),
        source: "review",
        rows: PERIOD_KEYS.flatMap((key) => {
          const model = modelPeriods.find((m) => m?.period_key === key);
          const human = incoming.find((entry) => entry?.period_key === key);
          if (!model || !human) return [];
          return [{
            period_key: key,
            model_raw_tally: model.raw_tally ?? null,
            model_confidence: model.confidence ?? null,
            model,
            human,
            human_not_observed: Boolean(human.not_observed),
          }];
        }),
      }),
    );
  }

  return NextResponse.json({ ok: true, id: saved.id, log_date: logDate });
}
