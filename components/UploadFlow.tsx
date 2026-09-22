"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import ReviewForm, { emptyParsedLog } from "@/components/ReviewForm";
import { BEHAVIORS } from "@/lib/behaviors";
import { bandFor } from "@/lib/geometry";
import { cropRow, prepareImage, releaseDetail, type PreparedImage } from "@/lib/image";
import { countsFromRow, rowsWorthZooming, type PageRow } from "@/lib/reconcile";
import type { ParsedLog, PeriodEntry } from "@/lib/types";

type Stage = "idle" | "working" | "review" | "done";

export default function UploadFlow() {
  const router = useRouter();
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [parsed, setParsed] = useState<ParsedLog | null>(null);
  const [raw, setRaw] = useState<unknown>(null);
  const [savedDate, setSavedDate] = useState<string | null>(null);

  /**
   * Re-read every row that carries a number, from a crop of that row.
   *
   * Skipped when the row grid wasn't measured from the page — cropping from a
   * guessed grid would hand the reader the wrong strip of paper, which is worse
   * than not checking at all. A failure here never blocks the review: the
   * whole-page reading stands and the rows say they went unchecked.
   */
  async function checkRowsCloseUp(
    parsedLog: ParsedLog,
    prepared: PreparedImage,
  ): Promise<{ parsed: ParsedLog; zooms: unknown }> {
    if (!prepared.detail || parsedLog.layout_source !== "measured") return { parsed: parsedLog, zooms: null };

    const pageRows: PageRow[] = parsedLog.periods.map((p) => ({
      period_key: p.period_key,
      raw_tally: p.raw_tally,
      not_observed: p.not_observed,
      confidence: p.confidence,
      counts: countsFromRow(p as unknown as Record<string, number>),
    }));

    const wanted = rowsWorthZooming(pageRows);
    if (wanted.length === 0) return { parsed: parsedLog, zooms: null };

    const crops: { period_key: string; image: string; mediaType: string }[] = [];
    for (const key of wanted) {
      const band = bandFor(parsedLog.layout, key);
      if (!band) continue;
      const crop = cropRow(prepared.detail, band, parsedLog.layout.left, parsedLog.layout.right);
      if (crop) crops.push({ period_key: key, ...crop });
    }
    if (crops.length === 0) return { parsed: parsedLog, zooms: null };

    setStatus(
      crops.length === 1
        ? "Checking that row close up…"
        : `Checking each of the ${crops.length} rows with marks close up…`,
    );

    try {
      const res = await fetch("/api/parse/rows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crops, periods: parsedLog.periods }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        periods?: PeriodEntry[];
        zooms?: unknown;
        error?: string;
      };
      if (!res.ok || !Array.isArray(body.periods)) throw new Error(body.error ?? "close-up failed");
      return { parsed: { ...parsedLog, periods: body.periods }, zooms: body.zooms ?? null };
    } catch {
      // The reading the parent is waiting for is already in hand. Say that the
      // extra check didn't happen and let them review.
      return {
        parsed: {
          ...parsedLog,
          periods: parsedLog.periods.map((p) =>
            wanted.includes(p.period_key)
              ? {
                  ...p,
                  flags: [
                    ...(p.flags ?? []),
                    "The close-up check of this row didn't run, so only the whole-page reading counted.",
                  ],
                }
              : p,
          ),
        },
        zooms: null,
      };
    }
  }

  async function handleFile(file: File) {
    setError(null);
    setStage("working");
    let prepared: PreparedImage | null = null;

    try {
      setStatus("Getting the photo ready…");
      prepared = await prepareImage(file);
      setImage(prepared);

      setStatus("Reading the handwriting… this takes a few seconds.");
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: prepared.base64, mediaType: prepared.mediaType }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        parsed?: ParsedLog;
        raw?: unknown;
        error?: string;
      };

      if (!res.ok || !body.parsed) {
        throw new Error(body.error ?? "Couldn't read that photo.");
      }

      // Second stage: read each row again from a close-up crop cut out of the
      // full-resolution photo. The whole-page read has to find ten rows and
      // count every glyph in all of them at once, which is where a run of
      // seven becomes eight; one row on its own is a much easier question.
      const checked = await checkRowsCloseUp(body.parsed, prepared);

      setParsed(checked.parsed);
      setRaw({ page: body.raw ?? null, close_up: checked.zooms });
      setStage("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      // Keep the photo: they can still fill it in by hand against the preview.
      setStage("idle");
    }
  }

  function enterByHand() {
    setError(null);
    setParsed(emptyParsedLog());
    setRaw(null);
    setStage("review");
  }

  function reset() {
    if (image) {
      URL.revokeObjectURL(image.previewUrl);
      releaseDetail(image.detail);
    }
    setImage(null);
    setParsed(null);
    setRaw(null);
    setSavedDate(null);
    setError(null);
    setStage("idle");
    if (cameraRef.current) cameraRef.current.value = "";
    if (libraryRef.current) libraryRef.current.value = "";
  }

  if (stage === "done" && savedDate) {
    return (
      <div className="card p-6 text-center">
        <p className="text-3xl">✓</p>
        <h2 className="mt-2 text-lg font-semibold">Saved for {savedDate}</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          The charts and tables are already updated.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="rounded-full py-3 text-sm font-medium text-white"
            style={{ background: BEHAVIORS[0].color }}
          >
            See the charts
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-full border py-3 text-sm font-medium"
            style={{ borderColor: "var(--border)" }}
          >
            Add another day
          </button>
        </div>
      </div>
    );
  }

  if (stage === "review" && parsed) {
    return (
      <div className="space-y-4">
        <ReviewForm
          initial={parsed}
          image={image ? { base64: image.base64, mediaType: image.mediaType } : null}
          previewUrl={image?.previewUrl ?? null}
          raw={raw}
          onSaved={(date) => {
            setSavedDate(date);
            setStage("done");
            router.refresh();
          }}
        />
        <button
          type="button"
          onClick={reset}
          className="w-full py-2 text-sm underline"
          style={{ color: "var(--text-muted)" }}
        >
          Start over
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      {image && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={image.previewUrl}
          alt="The behavior log you photographed"
          className="card w-full object-contain"
          style={{ maxHeight: "40vh" }}
        />
      )}

      {stage === "working" ? (
        <div className="card p-6 text-center">
          <div
            className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: "var(--axis)", borderTopColor: "transparent" }}
          />
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {status}
          </p>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="w-full rounded-2xl py-6 text-base font-semibold text-white"
            style={{ background: BEHAVIORS[0].color }}
          >
            📷 Take a photo of the log
          </button>
          <button
            type="button"
            onClick={() => libraryRef.current?.click()}
            className="w-full rounded-2xl border py-4 text-base font-medium"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
          >
            📁 Upload a picture from this phone
          </button>
          <p className="text-center text-xs" style={{ color: "var(--text-muted)" }}>
            Lay the page flat, get all ten rows in frame, and avoid shadows. Either way you
            check the numbers before anything is saved.
          </p>
        </>
      )}

      {error && (
        <div className="card p-4">
          <p className="text-sm" style={{ color: "var(--critical)" }}>
            {error}
          </p>
          <button
            type="button"
            onClick={enterByHand}
            className="mt-3 w-full rounded-full border py-3 text-sm font-medium"
            style={{ borderColor: "var(--border)" }}
          >
            Enter this one by hand instead
          </button>
        </div>
      )}

      {stage === "idle" && !error && (
        <button
          type="button"
          onClick={enterByHand}
          className="w-full py-2 text-sm underline"
          style={{ color: "var(--text-muted)" }}
        >
          Enter a log by hand
        </button>
      )}
    </div>
  );
}
