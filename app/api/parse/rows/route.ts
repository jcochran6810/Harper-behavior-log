import { NextResponse } from "next/server";
import { PERIOD_KEYS } from "@/lib/behaviors";
import { countsFromRow, reconcileRow, type Confidence, type PageRow } from "@/lib/reconcile";
import { readRowCrops, type RowCrop } from "@/lib/rowread";
import type { PeriodEntry } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300; // ten close-up reads, in parallel

const ALLOWED = ["image/jpeg", "image/png", "image/webp"] as const;
type Allowed = (typeof ALLOWED)[number];

/** Generous, but enough to stop a runaway payload. ~1.5MB of base64 per row. */
const MAX_CROP_CHARS = 2_000_000;

type Body = {
  crops?: { period_key?: unknown; image?: unknown; mediaType?: unknown }[];
  periods?: PeriodEntry[];
};

function asConfidence(value: unknown): Confidence {
  return value === "high" || value === "medium" || value === "low" ? value : "medium";
}

/**
 * The close-up pass over a photo that has already been read as a whole page.
 *
 * It is a separate request on purpose: the page read and ten row reads together
 * would sit in one very long function call, and keeping them apart means the
 * review screen can say which stage it is on — and that a failure here costs the
 * close-up check only, never the reading the parent is waiting for.
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const periods = Array.isArray(body.periods) ? body.periods : [];
  if (periods.length === 0) {
    return NextResponse.json({ error: "No rows to check." }, { status: 400 });
  }

  const crops: RowCrop[] = [];
  for (const raw of Array.isArray(body.crops) ? body.crops : []) {
    const key = String(raw?.period_key ?? "");
    const image = typeof raw?.image === "string" ? raw.image : "";
    const mediaType = String(raw?.mediaType ?? "image/jpeg");
    if (!PERIOD_KEYS.includes(key)) continue;
    if (!image || image.length > MAX_CROP_CHARS) continue;
    if (!ALLOWED.includes(mediaType as Allowed)) continue;
    if (crops.some((c) => c.period_key === key)) continue;
    crops.push({ period_key: key, image, mediaType: mediaType as Allowed });
    if (crops.length >= PERIOD_KEYS.length) break;
  }

  if (crops.length === 0) {
    return NextResponse.json({ error: "No usable row crops were sent." }, { status: 400 });
  }

  const zooms = await readRowCrops(crops);
  const zoomByKey = new Map(zooms.map((z) => [z.period_key, z]));

  const checked: PeriodEntry[] = periods.map((entry) => {
    const key = String(entry?.period_key ?? "");
    const zoom = zoomByKey.get(key) ?? null;
    if (!zoom) return entry;

    const page: PageRow = {
      period_key: key,
      raw_tally: entry.raw_tally ?? null,
      not_observed: Boolean(entry.not_observed),
      confidence: asConfidence(entry.confidence),
      counts: countsFromRow(entry as unknown as Record<string, number>),
    };

    const outcome = reconcileRow(page, zoom);
    return {
      ...entry,
      raw_tally: outcome.raw_tally,
      confidence: outcome.confidence,
      ...outcome.counts,
      flags: [...(entry.flags ?? []), ...outcome.flags],
    };
  });

  return NextResponse.json({
    periods: checked,
    checked: crops.length,
    zooms: zooms.map((z) => ({
      period_key: z.period_key,
      raw_tally: z.raw_tally,
      confidence: z.confidence,
      error: z.error ?? null,
    })),
  });
}
