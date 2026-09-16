"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import ReviewForm, { emptyParsedLog } from "@/components/ReviewForm";
import { BEHAVIORS } from "@/lib/behaviors";
import { prepareImage, type PreparedImage } from "@/lib/image";
import type { ParsedLog } from "@/lib/types";

type Stage = "idle" | "working" | "review" | "done";

export default function UploadFlow() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [parsed, setParsed] = useState<ParsedLog | null>(null);
  const [raw, setRaw] = useState<unknown>(null);
  const [savedDate, setSavedDate] = useState<string | null>(null);

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

      setParsed(body.parsed);
      setRaw(body.raw ?? null);
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
    if (image) URL.revokeObjectURL(image.previewUrl);
    setImage(null);
    setParsed(null);
    setRaw(null);
    setSavedDate(null);
    setError(null);
    setStage("idle");
    if (fileRef.current) fileRef.current.value = "";
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
        {image && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={image.previewUrl}
            alt="The behavior log you photographed"
            className="card w-full object-contain"
            style={{ maxHeight: "50vh" }}
          />
        )}
        <ReviewForm
          initial={parsed}
          image={image ? { base64: image.base64, mediaType: image.mediaType } : null}
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
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
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
            onClick={() => fileRef.current?.click()}
            className="w-full rounded-2xl py-6 text-base font-semibold text-white"
            style={{ background: BEHAVIORS[0].color }}
          >
            📷 Take a photo of the log
          </button>
          <p className="text-center text-xs" style={{ color: "var(--text-muted)" }}>
            Lay the page flat, get all ten rows in frame, and avoid shadows.
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
