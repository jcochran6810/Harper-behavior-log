import { NextResponse } from "next/server";
import { db, PHOTO_BUCKET } from "@/lib/supabase";

export const runtime = "nodejs";

/** Hands out a short-lived signed URL so photos never need a public bucket. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = db();

  const { data: log } = await supabase
    .from("harper_daily_logs")
    .select("image_path")
    .eq("id", id)
    .maybeSingle();

  if (!log?.image_path) {
    return NextResponse.json({ error: "No photo saved for this day." }, { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(log.image_path, 60);

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Couldn't open the photo." }, { status: 500 });
  }
  return NextResponse.redirect(data.signedUrl);
}
