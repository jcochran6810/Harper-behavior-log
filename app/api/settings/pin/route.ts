import { NextResponse } from "next/server";
import { checkPin, PIN_PATTERN, setPin } from "@/lib/pin";

export const runtime = "nodejs";

/** Changing the PIN requires knowing the current one, even behind the gate. */
export async function POST(request: Request) {
  let body: { currentPin?: unknown; newPin?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const currentPin = String(body.currentPin ?? "");
  const newPin = String(body.newPin ?? "");

  if (!PIN_PATTERN.test(newPin)) {
    return NextResponse.json({ error: "The new PIN has to be exactly 4 digits." }, { status: 400 });
  }
  if (!(await checkPin(currentPin))) {
    return NextResponse.json({ error: "That's not the current PIN." }, { status: 401 });
  }
  if (currentPin === newPin) {
    return NextResponse.json({ error: "That's already the PIN." }, { status: 400 });
  }

  try {
    await setPin(newPin);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't save the new PIN." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
