import { NextResponse } from "next/server";
import { db, PHOTO_BUCKET } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Attach (or replace) the photographed page for a day that already exists.
 *
 * The first logs were transcribed before photos were being kept, and a day with
 * no picture can't be checked against anything — which is exactly how a bad
 * count survives. This lets the original page be added after the fact without
 * deleting the day and re-entering it.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: { image?: unknown; mediaType?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const image = typeof body.image === "string" ? body.image : "";
  if (!image) return NextResponse.json({ error: "No photo was attached." }, { status: 400 });

  const mediaType = body.mediaType === "image/png" ? "image/png" : "image/jpeg";
  const ext = mediaType === "image/png" ? "png" : "jpg";

  const supabase = db();
  const { data: log } = await supabase
    .from("harper_daily_logs")
    .select("log_date, image_path")
    .eq("id", id)
    .maybeSingle();

  if (!log) return NextResponse.json({ error: "That day isn't saved." }, { status: 404 });

  const path = `${log.log_date}-${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, Buffer.from(image, "base64"), { contentType: mediaType, upsert: true });

  if (uploadError) {
    return NextResponse.json(
      { error: `Couldn't save the photo: ${uploadError.message}` },
      { status: 500 },
    );
  }

  const { error } = await supabase
    .from("harper_daily_logs")
    .update({ image_path: path, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Only drop the old file once the new one is safely recorded.
  if (log.image_path && log.image_path !== path) {
    await supabase.storage.from(PHOTO_BUCKET).remove([log.image_path]);
  }

  return NextResponse.json({ ok: true });
}
