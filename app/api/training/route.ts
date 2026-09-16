import { NextResponse } from "next/server";
import { BEHAVIOR_KEYS } from "@/lib/behaviors";
import { db } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * The collected training set, as JSON Lines — one labelled cell per line.
 *
 * Each line says which photo the cell comes from and where on it (as fractions,
 * so a crop can be cut at any resolution), what the reader thought it was, and
 * what a human confirmed. Cropping happens wherever the training happens; the
 * photos themselves stay in the private bucket and are not included here.
 */
export async function GET(request: Request) {
  const onlyCorrected = new URL(request.url).searchParams.get("corrected") === "1";

  let query = db()
    .from("harper_training_samples")
    .select("*")
    .order("log_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (onlyCorrected) query = query.eq("corrected", true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const lines = (data ?? []).map((row) =>
    JSON.stringify({
      date: row.log_date,
      period: row.period_key,
      image: row.image_path,
      box: row.box,
      model_tally: row.model_raw_tally,
      model_confidence: row.model_confidence,
      model: Object.fromEntries(BEHAVIOR_KEYS.map((k) => [k, row.model_counts?.[k] ?? 0])),
      label: Object.fromEntries(BEHAVIOR_KEYS.map((k) => [k, row.human_counts?.[k] ?? 0])),
      not_observed: row.human_not_observed,
      corrected: row.corrected,
      source: row.source,
      at: row.created_at,
    }),
  );

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Content-Disposition": `attachment; filename="harper-training-${new Date()
        .toISOString()
        .slice(0, 10)}.jsonl"`,
      "Cache-Control": "no-store",
    },
  });
}
