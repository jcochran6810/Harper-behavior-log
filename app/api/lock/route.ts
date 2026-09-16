import { NextResponse } from "next/server";
import { COOKIE_NAME, sessionCookieOptions } from "@/lib/session";

export const runtime = "nodejs";

/** Clears the session cookie so the next visit needs the PIN again. */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, "", { ...sessionCookieOptions, maxAge: 0 });
  return response;
}
