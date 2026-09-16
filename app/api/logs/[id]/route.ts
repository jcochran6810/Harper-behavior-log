import { NextResponse } from "next/server";
import { BEHAVIOR_KEYS, PERIOD_KEYS } from "@/lib/behaviors";
import { normalizeLayout } from "@/lib/geometry";
import { buildSamples, recordSamples } from "@/lib/training";
import { db, PHOTO_BUCKET } from "@/lib/supabase";

export const runtime = "nodejs";

type PeriodPatch = {
  period_key?: string;
  notes?: string | null;
  specials_subject?: string | null;
  not_observed?: boolean;
  smiley_count?: number;
} & Partial<Record<(typeof BEHAVIOR_KEYS)[number], number>>;

function count(value: unknown): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 99) : 0;
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = db();

  const { data: log } = await supabase
    .from("harper_daily_logs")
    .select("image_path")
    .eq("id", id)
    .maybeSingle();

  if (log?.image_path) {
    await supabase.storage.from(PHOTO_BUCKET).remove([log.image_path]);
  }

  // Period rows cascade with the parent.
  const { error } = await supabase.from("harper_daily_logs").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: {
    log_date?: string;
    date_confirmed?: boolean;
    overall_note?: string | null;
    periods?: PeriodPatch[];
    layout?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  // Correcting the numbers on a saved day. Each period row is updated in place,
  // so the day keeps its id, its photo and its original machine reading — the
  // correction is the human's, and the audit trail behind it stays intact.
  if (Array.isArray(body.periods)) {
    const supabase = db();

    // Read the day as it stands before overwriting it: the stored numbers are
    // what the machine (or an earlier pass) believed, and the incoming ones are
    // the human's verdict. That pairing is the training sample.
    const { data: before } = await supabase
      .from("harper_daily_logs")
      .select(
        "log_date, image_path, row_geometry, harper_log_periods (period_key, raw_tally, confidence, b1,b2,b3,b4,b5,b6,b7,b8)",
      )
      .eq("id", id)
      .maybeSingle();

    for (const period of body.periods) {
      const key = String(period?.period_key ?? "");
      if (!PERIOD_KEYS.includes(key)) continue;

      const notObserved = Boolean(period.not_observed);
      const row: Record<string, unknown> = {
        not_observed: notObserved,
        notes: text(period.notes, 4000),
        smiley_count: count(period.smiley_count),
        // A hand-checked number is the best reading there is.
        confidence: "high",
      };
      if (key === "specials") row.specials_subject = text(period.specials_subject, 60);
      for (const bk of BEHAVIOR_KEYS) row[bk] = notObserved ? 0 : count(period[bk]);

      const { error } = await supabase
        .from("harper_log_periods")
        .update(row)
        .eq("log_id", id)
        .eq("period_key", key);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { error: stampError } = await supabase
      .from("harper_daily_logs")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", id);
    if (stampError) return NextResponse.json({ error: stampError.message }, { status: 500 });

    if (before) {
      const priorByKey = new Map(
        (before.harper_log_periods ?? []).map((p) => [p.period_key, p]),
      );
      await recordSamples(
        buildSamples({
          log_id: id,
          log_date: before.log_date,
          image_path: before.image_path,
          layout: normalizeLayout(before.row_geometry),
          source: "correction",
          rows: body.periods.flatMap((period) => {
            const key = String(period?.period_key ?? "");
            const prior = priorByKey.get(key);
            if (!prior) return [];
            return [{
              period_key: key,
              model_raw_tally: prior.raw_tally ?? null,
              model_confidence: prior.confidence ?? null,
              model: prior,
              human: period,
              human_not_observed: Boolean(period.not_observed),
            }];
          }),
        }),
      );
    }
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.layout !== undefined) {
    const layout = normalizeLayout(body.layout);
    if (!layout) {
      return NextResponse.json({ error: "That box grid doesn't look right." }, { status: 400 });
    }
    patch.row_geometry = layout;
  }
  if (typeof body.overall_note === "string" || body.overall_note === null) {
    patch.overall_note = text(body.overall_note, 4000);
  }
  if (typeof body.log_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.log_date)) {
    patch.log_date = body.log_date;
    patch.date_confirmed = true;
  }
  if (typeof body.date_confirmed === "boolean") patch.date_confirmed = body.date_confirmed;

  const { error } = await db().from("harper_daily_logs").update(patch).eq("id", id);
  if (error) {
    const duplicate = error.message.includes("duplicate") || error.code === "23505";
    return NextResponse.json(
      { error: duplicate ? "There's already a log saved for that date." : error.message },
      { status: duplicate ? 409 : 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
