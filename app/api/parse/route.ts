import { NextResponse } from "next/server";
import { parseLogImage } from "@/lib/parse";

export const runtime = "nodejs";
export const maxDuration = 300; // handwriting reading can take a while

const ALLOWED = ["image/jpeg", "image/png", "image/webp"] as const;
type Allowed = (typeof ALLOWED)[number];

export async function POST(request: Request) {
  let body: { image?: unknown; mediaType?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const image = typeof body.image === "string" ? body.image : "";
  const mediaType = String(body.mediaType ?? "image/jpeg");

  if (!image) {
    return NextResponse.json({ error: "No photo was attached." }, { status: 400 });
  }
  if (!ALLOWED.includes(mediaType as Allowed)) {
    return NextResponse.json(
      { error: "That file type isn't supported. Use a JPEG or PNG photo." },
      { status: 400 },
    );
  }

  try {
    const { parsed, raw } = await parseLogImage(image, mediaType as Allowed);
    return NextResponse.json({ parsed, raw });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't read that photo.";
    // 422: the request was fine, the photo (or config) wasn't.
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
