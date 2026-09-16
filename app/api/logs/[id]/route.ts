import { NextResponse } from "next/server";
import { db, PHOTO_BUCKET } from "@/lib/supabase";

export const runtime = "nodejs";

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
  let body: { log_date?: string; date_confirmed?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
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
