import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { checkPin } from "@/lib/pin";
import { COOKIE_NAME, createSessionToken, sessionCookieOptions } from "@/lib/session";

export const runtime = "nodejs";

const WINDOW_MINUTES = 15;
const MAX_FAILURES = 10;

function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0] : request.headers.get("x-real-ip") ?? "unknown").trim();
}

export async function POST(request: Request) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "This site isn't finished setting up (missing SESSION_SECRET)." },
      { status: 500 },
    );
  }

  let pin = "";
  try {
    pin = String(((await request.json()) as { pin?: unknown }).pin ?? "");
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const ip = clientIp(request);
  const supabase = db();
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();

  const { count } = await supabase
    .from("harper_pin_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .eq("ok", false)
    .gte("at", since);

  if ((count ?? 0) >= MAX_FAILURES) {
    return NextResponse.json(
      { error: `Too many tries. Wait ${WINDOW_MINUTES} minutes and try again.` },
      { status: 429 },
    );
  }

  const ok = await checkPin(pin);
  await supabase.from("harper_pin_attempts").insert({ ip, ok });

  if (!ok) {
    const left = Math.max(0, MAX_FAILURES - (count ?? 0) - 1);
    return NextResponse.json(
      { error: left <= 3 ? `Wrong PIN — ${left} tries left.` : "Wrong PIN." },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, await createSessionToken(secret), sessionCookieOptions);
  return response;
}
