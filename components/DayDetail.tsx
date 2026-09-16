"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { BEHAVIORS, BEHAVIOR_KEYS, PERIOD_KEYS, PERIODS, type BehaviorKey } from "@/lib/behaviors";
import { fallbackLayout, type Layout } from "@/lib/geometry";
import { prepareImage } from "@/lib/image";
import PhotoBoxes from "@/components/PhotoBoxes";
import { readTally, sameCounts, zeroCounts } from "@/lib/tally";
import type { LogWithPeriods } from "@/lib/types";

type Row = LogWithPeriods["harper_log_periods"][number];

function longDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function Counter({
  code,
  value,
  onChange,
}: {
  code: number;
  value: number;
  onChange: (next: number) => void;
}) {
  const behavior = BEHAVIORS.find((b) => b.code === code)!;
  const active = value > 0;
  return (
    <div
      className="flex items-center justify-between rounded-lg border px-1.5 py-1"
      style={{
        borderColor: active ? behavior.color : "var(--border)",
        background: active ? `${behavior.color}14` : "transparent",
      }}
    >
      <button
        type="button"
        aria-label={`One fewer ${behavior.label}`}
        onClick={() => onChange(Math.max(0, value - 1))}
        className="h-8 w-7 shrink-0 rounded text-lg leading-none active:scale-90"
        style={{ color: "var(--text-secondary)" }}
      >
        −
      </button>
      <span className="flex min-w-0 flex-col items-center leading-none" title={behavior.label}>
        <span className="tnum text-base font-semibold" style={{ color: "var(--text-primary)" }}>
          {value}
        </span>
        <span className="mt-0.5 truncate text-[10px]" style={{ color: "var(--text-muted)" }}>
          {code}. {behavior.short}
        </span>
      </span>
      <button
        type="button"
        aria-label={`One more ${behavior.label}`}
        onClick={() => onChange(Math.min(99, value + 1))}
        className="h-8 w-7 shrink-0 rounded text-lg leading-none active:scale-90"
        style={{ color: "var(--text-secondary)" }}
      >
        +
      </button>
    </div>
  );
}

/**
 * One school day in full: the photographed page next to the numbers taken off
 * it, every row showing the marks it was counted from, and an edit mode for
 * putting a miscount right without deleting and re-photographing the day.
 */
export default function DayDetail({
  log,
  photoUrl,
}: {
  log: LogWithPeriods;
  photoUrl: string | null;
}) {
  const router = useRouter();
  const ordered = useMemo(
    () =>
      [...log.harper_log_periods].sort(
        (a, b) => PERIOD_KEYS.indexOf(a.period_key) - PERIOD_KEYS.indexOf(b.period_key),
      ),
    [log.harper_log_periods],
  );

  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<Row[]>(ordered);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [layout, setLayout] = useState<Layout>(log.row_geometry ?? fallbackLayout());
  const [layoutEstimated, setLayoutEstimated] = useState(!log.row_geometry);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLElement | null>>({});
  const [uploading, setUploading] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  const shown = editing ? rows : ordered;
  const dayTotal = shown.reduce(
    (sum, p) => sum + BEHAVIOR_KEYS.reduce((acc, k) => acc + (p[k] ?? 0), 0),
    0,
  );
  const smileys = shown.reduce((sum, p) => sum + (p.smiley_count ?? 0), 0);

  const totalsByPeriod = useMemo(
    () =>
      Object.fromEntries(
        shown.map((p) => [
          p.period_key,
          BEHAVIOR_KEYS.reduce((acc, k) => acc + (p[k] ?? 0), 0),
        ]),
      ) as Record<string, number>,
    [shown],
  );

  /** Rows whose stored numbers no longer agree with the marks on the page. */
  const mismatchedKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const p of shown) {
      const subtotal = BEHAVIOR_KEYS.reduce((acc, k) => acc + (p[k] ?? 0), 0);
      if (p.not_observed) {
        if (subtotal > 0) keys.add(p.period_key);
        continue;
      }
      const reading = readTally(p.raw_tally);
      if (reading.empty || !reading.understood) continue;
      const stored = zeroCounts();
      for (const k of BEHAVIOR_KEYS) stored[k] = p[k] ?? 0;
      if (!sameCounts(stored, reading.counts)) keys.add(p.period_key);
    }
    return keys;
  }, [shown]);

  function update(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((p) => (p.period_key === key ? { ...p, ...patch } : p)));
  }

  /** Re-count a row straight from the marks transcribed off the page. */
  function recountFromMarks(row: Row) {
    const reading = readTally(row.raw_tally);
    if (reading.empty || !reading.understood) return;
    update(row.period_key, reading.counts as Partial<Row>);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/logs/${log.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periods: rows.map((p) => ({
            period_key: p.period_key,
            notes: p.notes,
            specials_subject: p.specials_subject,
            not_observed: p.not_observed,
            smiley_count: p.smiley_count,
            ...Object.fromEntries(BEHAVIOR_KEYS.map((k) => [k, p[k]])),
          })),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Couldn't save those corrections.");
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save those corrections.");
    } finally {
      setSaving(false);
    }
  }

  /** Tapping a box: open the editor and land on that row. */
  function pickPeriod(key: string) {
    if (!editing) {
      setRows(ordered);
      setEditing(true);
    }
    setActiveKey(key);
    // The row only exists once the editor has rendered it.
    requestAnimationFrame(() =>
      rowRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
  }

  /** An aligned grid is worth keeping — it belongs to this photo, not this visit. */
  async function saveLayout(next: Layout) {
    setLayout(next);
    setLayoutEstimated(false);
    await fetch(`/api/logs/${log.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ layout: next }),
    }).catch(() => {});
  }

  async function attachPhoto(file: File) {
    setUploading(true);
    setError(null);
    try {
      const prepared = await prepareImage(file);
      const res = await fetch(`/api/logs/${log.id}/photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: prepared.base64, mediaType: prepared.mediaType }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Couldn't save that photo.");
      URL.revokeObjectURL(prepared.previewUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that photo.");
    } finally {
      setUploading(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (libraryRef.current) libraryRef.current.value = "";
    }
  }

  async function fixDate(value: string) {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/logs/${log.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ log_date: value }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Couldn't change that date.");
      return;
    }
    router.replace(`/day/${value}`);
    router.refresh();
  }

  async function remove() {
    setSaving(true);
    await fetch(`/api/logs/${log.id}`, { method: "DELETE" });
    router.push("/data");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {!log.date_confirmed && (
        <section className="card p-4">
          <p className="text-sm">
            The date box was blank on this form. Check the photo and set the right date:
          </p>
          <input
            type="date"
            defaultValue={log.log_date}
            onChange={(e) => e.target.value && void fixDate(e.target.value)}
            disabled={saving}
            className="mt-2 rounded-lg border px-3 py-2"
            style={{ borderColor: "var(--border)", background: "transparent", color: "var(--text-primary)" }}
          />
        </section>
      )}

      {/* ------------------------------------------------ the photographed page */}
      <section className="card overflow-hidden">
        {photoUrl ? (
          <>
            <PhotoBoxes
              src={photoUrl}
              alt={`The paper behavior log for ${longDate(log.log_date)}`}
              layout={layout}
              totals={totalsByPeriod}
              flagged={mismatchedKeys}
              activeKey={activeKey}
              estimated={layoutEstimated}
              onPick={pickPeriod}
              onLayoutChange={(next) => void saveLayout(next)}
            />
            <p className="px-4 py-2 text-xs" style={{ color: "var(--text-muted)" }}>
              <button type="button" onClick={() => setZoomed(true)} className="underline">
                Open the page full size
              </button>{" "}
              to read the marks.{" "}
              <button
                type="button"
                onClick={() => libraryRef.current?.click()}
                disabled={uploading}
                className="underline"
              >
                {uploading ? "Saving…" : "Replace this photo"}
              </button>
            </p>
          </>
        ) : (
          <div className="p-4">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              No photo was saved for this day — it was typed in by hand, or transcribed before
              photos were being kept. If you still have the paper, photograph it now and the
              numbers below can be checked against it.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                disabled={uploading}
                className="rounded-full py-2.5 text-sm font-medium text-white disabled:opacity-50 sm:flex-1"
                style={{ background: BEHAVIORS[0].color }}
              >
                {uploading ? "Saving…" : "📷 Photograph this page"}
              </button>
              <button
                type="button"
                onClick={() => libraryRef.current?.click()}
                disabled={uploading}
                className="rounded-full border py-2.5 text-sm font-medium disabled:opacity-50 sm:flex-1"
                style={{ borderColor: "var(--border)" }}
              >
                📁 Pick a picture
              </button>
            </div>
          </div>
        )}

        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void attachPhoto(file);
          }}
        />
        <input
          ref={libraryRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void attachPhoto(file);
          }}
        />
      </section>

      {zoomed && photoUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="The original page, full size"
          onClick={() => setZoomed(false)}
          className="fixed inset-0 z-50 overflow-auto p-2"
          style={{ background: "rgba(0,0,0,0.92)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt={`The paper behavior log for ${longDate(log.log_date)}`}
            className="mx-auto w-full max-w-none"
            style={{ minWidth: "150%" }}
          />
          <button
            type="button"
            onClick={() => setZoomed(false)}
            className="fixed right-3 top-3 rounded-full px-4 py-2 text-sm font-medium text-white"
            style={{ background: "rgba(0,0,0,0.6)" }}
          >
            Close ✕
          </button>
        </div>
      )}

      {/* ------------------------------------------------------ the day's totals */}
      <section className="card flex items-center justify-between gap-3 p-4">
        <div>
          <p className="tnum text-3xl font-semibold">{dayTotal}</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            incidents recorded{smileys > 0 ? ` · ${smileys} smileys` : ""}
          </p>
        </div>
        {editing ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="rounded-full px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              style={{ background: BEHAVIORS[0].color }}
            >
              {saving ? "Saving…" : "Save corrections"}
            </button>
            <button
              type="button"
              onClick={() => {
                setRows(ordered);
                setEditing(false);
                setError(null);
              }}
              className="rounded-full border px-4 py-2 text-sm"
              style={{ borderColor: "var(--border)" }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setRows(ordered);
              setEditing(true);
            }}
            className="rounded-full border px-4 py-2 text-sm font-medium"
            style={{ borderColor: "var(--border)" }}
          >
            Fix these numbers
          </button>
        )}
      </section>

      {error && (
        <p className="rounded-lg px-4 py-3 text-sm" style={{ background: "var(--surface-1)", color: "var(--critical)" }}>
          {error}
        </p>
      )}

      {log.overall_note && (
        <p className="card p-4 text-sm" style={{ color: "var(--text-secondary)" }}>
          {log.overall_note}
        </p>
      )}

      {/* ------------------------------------------------------ period by period */}
      {shown.map((p) => {
        const meta = PERIODS.find((x) => x.key === p.period_key);
        const subtotal = BEHAVIOR_KEYS.reduce((acc, k) => acc + (p[k] ?? 0), 0);
        const active = BEHAVIORS.filter((b) => (p[`b${b.code}` as BehaviorKey] ?? 0) > 0);

        // Does what's stored still match the marks transcribed off the page?
        const reading = readTally(p.raw_tally);
        const stored = zeroCounts();
        for (const k of BEHAVIOR_KEYS) stored[k] = p[k] ?? 0;
        const marksDisagree =
          !reading.empty && reading.understood && !p.not_observed && !sameCounts(stored, reading.counts);
        // A period the teacher couldn't watch can't also have counted incidents.
        const contradicts = p.not_observed && subtotal > 0;

        const quiet =
          !editing && subtotal === 0 && !p.notes && !p.not_observed && activeKey !== p.period_key;
        if (quiet) return null;

        return (
          <section
            key={p.period_key}
            ref={(el) => {
              rowRefs.current[p.period_key] = el;
            }}
            className="card scroll-mt-4 p-4"
            style={
              activeKey === p.period_key
                ? { borderColor: BEHAVIORS[0].color, borderWidth: 2 }
                : marksDisagree || contradicts
                  ? { borderColor: "var(--warning)", borderWidth: 2 }
                  : undefined
            }
          >
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold">
                {meta?.label ?? p.period_key}
                {p.specials_subject && (
                  <span className="font-normal" style={{ color: "var(--text-muted)" }}>
                    {" "}— {p.specials_subject}
                  </span>
                )}
                <span className="ml-1.5 text-xs font-normal" style={{ color: "var(--text-muted)" }}>
                  {meta?.timeRange}
                </span>
              </h3>
              <span className="tnum text-sm" style={{ color: "var(--text-muted)" }}>
                {subtotal}
              </span>
            </div>

            {p.raw_tally && (
              <p
                className="mb-2 rounded px-2 py-1 text-xs"
                style={{ background: "var(--page)", color: "var(--text-secondary)" }}
              >
                Marks on the page: <span className="font-mono">{p.raw_tally}</span>
              </p>
            )}

            {contradicts && (
              <p
                className="mb-2 rounded-lg px-2.5 py-2 text-xs"
                style={{ background: "var(--page)", color: "var(--text-secondary)" }}
              >
                ⚠ This period is marked “the teacher couldn&apos;t observe it”, yet{" "}
                <strong className="tnum">{subtotal}</strong> incidents are counted against it.
                One of the two is wrong — check the page.
              </p>
            )}

            {marksDisagree && (
              <div className="mb-2 rounded-lg px-2.5 py-2 text-xs" style={{ background: "var(--page)" }}>
                <p style={{ color: "var(--text-secondary)" }}>
                  ⚠ The saved numbers don&apos;t match those marks — counting the marks gives{" "}
                  <strong className="tnum">
                    {BEHAVIOR_KEYS.reduce((a, k) => a + reading.counts[k], 0)}
                  </strong>
                  , not <strong className="tnum">{subtotal}</strong>.
                </p>
                {editing && (
                  <button
                    type="button"
                    onClick={() => recountFromMarks(p)}
                    className="mt-1.5 underline"
                    style={{ color: BEHAVIORS[0].color }}
                  >
                    Use the count from the marks
                  </button>
                )}
              </div>
            )}

            {editing ? (
              <>
                <label className="mb-2 flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                  <input
                    type="checkbox"
                    checked={p.not_observed}
                    onChange={(e) => update(p.period_key, { not_observed: e.target.checked })}
                    className="h-4 w-4"
                  />
                  Teacher couldn&apos;t observe this period
                </label>

                {!p.not_observed && (
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    {BEHAVIORS.map((b) => (
                      <Counter
                        key={b.code}
                        code={b.code}
                        value={p[`b${b.code}` as BehaviorKey] ?? 0}
                        onChange={(next) =>
                          update(p.period_key, { [`b${b.code}`]: next } as Partial<Row>)
                        }
                      />
                    ))}
                  </div>
                )}

                <textarea
                  value={p.notes ?? ""}
                  onChange={(e) => update(p.period_key, { notes: e.target.value || null })}
                  placeholder="Teacher's notes for this period"
                  rows={2}
                  className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--border)", background: "transparent", color: "var(--text-primary)" }}
                />
              </>
            ) : (
              <>
                {active.length > 0 && (
                  <p className="flex flex-wrap gap-1.5">
                    {active.map((b) => (
                      <span
                        key={b.code}
                        className="tnum rounded px-1.5 py-0.5 text-xs"
                        style={{ background: `${b.color}1f`, color: "var(--text-primary)" }}
                        title={b.label}
                      >
                        {b.short} ×{p[`b${b.code}` as BehaviorKey]}
                      </span>
                    ))}
                  </p>
                )}
                {p.notes && (
                  <p className="mt-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
                    {p.notes}
                  </p>
                )}
                {p.not_observed && (
                  <p className="mt-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                    The teacher couldn&apos;t observe this period.
                  </p>
                )}
              </>
            )}
          </section>
        );
      })}

      {!editing && (
        <div className="pt-2 text-center text-xs">
          {confirmingDelete ? (
            <span className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => void remove()}
                disabled={saving}
                className="underline"
                style={{ color: "var(--critical)" }}
              >
                {saving ? "Deleting…" : "Yes, delete this whole day"}
              </button>
              <button type="button" onClick={() => setConfirmingDelete(false)} className="underline">
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="underline"
              style={{ color: "var(--text-muted)" }}
            >
              Delete this day
            </button>
          )}
        </div>
      )}
    </div>
  );
}
