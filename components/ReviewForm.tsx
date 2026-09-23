"use client";

import { useMemo, useRef, useState } from "react";
import { BEHAVIORS, PERIODS, type SupportKey } from "@/lib/behaviors";
import { fallbackLayout, type Layout } from "@/lib/geometry";
import PhotoBoxes from "@/components/PhotoBoxes";
import SupportCounters from "@/components/SupportCounters";
import type { ParsedLog, PeriodEntry } from "@/lib/types";

export function emptyParsedLog(): ParsedLog {
  return {
    log_date: null,
    day_of_week: null,
    overall_note: null,
    periods: PERIODS.map((p) => ({
      period_key: p.key,
      specials_subject: null,
      antecedent: null,
      notes: null,
      raw_tally: null,
      smiley_count: 0,
      not_observed: false,
      confidence: "high" as const,
      b1: 0, b2: 0, b3: 0, b4: 0, b5: 0, b6: 0, b7: 0, b8: 0,
    })),
    layout: fallbackLayout(),
    layout_source: "estimated",
    assistance_count: 0,
    removed_count: 0,
  };
}

const KEYS = ["b1", "b2", "b3", "b4", "b5", "b6", "b7", "b8"] as const;

function todayISO(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function weekdayFrom(iso: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
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

export default function ReviewForm({
  initial,
  image,
  previewUrl,
  raw,
  onSaved,
}: {
  initial: ParsedLog;
  image: { base64: string; mediaType: string } | null;
  /** Local object URL of the photo, so boxes can be drawn over it before saving. */
  previewUrl?: string | null;
  raw: unknown;
  onSaved: (date: string) => void;
}) {
  const [date, setDate] = useState(initial.log_date ?? todayISO());
  const [dateGuessed] = useState(initial.log_date === null);
  const [note, setNote] = useState(initial.overall_note ?? "");
  const [periods, setPeriods] = useState<PeriodEntry[]>(initial.periods);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [support, setSupport] = useState<Record<SupportKey, number>>({
    assistance_count: initial.assistance_count ?? 0,
    removed_count: initial.removed_count ?? 0,
  });
  // The reviewer's tick that those two are right. Never pre-ticked: the whole
  // point is that a person looked, and a box that arrives already ticked records
  // nothing.
  const [supportConfirmed, setSupportConfirmed] = useState(false);
  const [triedToSave, setTriedToSave] = useState(false);
  const supportRef = useRef<HTMLElement>(null);
  const [layout, setLayout] = useState<Layout>(initial.layout ?? fallbackLayout());
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLElement | null>>({});

  /** Tapping a box on the photo jumps to that row's counters. */
  function focusPeriod(key: string) {
    setActiveKey(key);
    rowRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const totalsByPeriod = useMemo(
    () =>
      Object.fromEntries(
        periods.map((p) => [p.period_key, KEYS.reduce((acc, k) => acc + p[k], 0)]),
      ) as Record<string, number>,
    [periods],
  );

  const flaggedKeys = useMemo(
    () =>
      new Set(
        periods
          .filter((p) => p.confidence !== "high" || (p.flags?.length ?? 0) > 0)
          .map((p) => p.period_key),
      ),
    [periods],
  );

  const flaggedCount = useMemo(
    () => periods.filter((p) => p.confidence !== "high" || (p.flags?.length ?? 0) > 0).length,
    [periods],
  );

  const dayTotal = useMemo(
    () => periods.reduce((sum, p) => sum + KEYS.reduce((acc, k) => acc + p[k], 0), 0),
    [periods],
  );

  function update(index: number, patch: Partial<PeriodEntry>) {
    setPeriods((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  /** A claim of one or more support events has to be vouched for before it is saved. */
  const supportNeedsTick =
    support.assistance_count + support.removed_count > 0 && !supportConfirmed;

  async function save(replace: boolean) {
    setTriedToSave(true);
    if (supportNeedsTick) {
      setError(
        "Tick the box confirming the assistance and removal counts before saving — they're read out of the teacher's wording, so they need a person to agree with them.",
      );
      supportRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          log_date: date,
          day_of_week: weekdayFrom(date),
          overall_note: note || null,
          date_confirmed: true,
          ...support,
          support_confirmed: supportConfirmed,
          periods,
          image: image?.base64 ?? null,
          mediaType: image?.mediaType ?? null,
          raw,
          layout,
          // The reader's untouched answer, so the save can record where a human
          // disagreed with it. `periods` above is the edited version.
          model_periods: raw ? initial.periods : null,
          replace,
        }),
      });

      if (res.status === 409) {
        setConfirmReplace(true);
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Couldn't save this log.");
      onSaved(date);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save this log.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {previewUrl && (
        <PhotoBoxes
          src={previewUrl}
          alt="The behavior log you photographed"
          layout={layout}
          totals={totalsByPeriod}
          flagged={flaggedKeys}
          activeKey={activeKey}
          estimated={initial.layout_source === "estimated"}
          onPick={focusPeriod}
          onLayoutChange={setLayout}
        />
      )}

      <section className="card p-4">
        <label className="block text-sm font-medium" htmlFor="log-date">
          Date on this log
        </label>
        <input
          id="log-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-2 w-full rounded-lg border px-3 py-2"
          style={{ borderColor: "var(--border)", background: "transparent", color: "var(--text-primary)" }}
        />
        <p className="mt-2 text-xs" style={{ color: dateGuessed ? "var(--critical)" : "var(--text-muted)" }}>
          {dateGuessed
            ? "The date box on the form was blank — please set the right date before saving."
            : `Read from the form · ${weekdayFrom(date) ?? ""}`}
        </p>
      </section>

      {/* The day's own tally box — one pair of counts for the whole page, never
          folded into the incident total. Read out of the teacher's words rather
          than off the tally marks, so it always gets looked at. */}
      <section className="card p-4" ref={supportRef}>
        <SupportCounters
          values={support}
          onChange={(key, next) => setSupport((prev) => ({ ...prev, [key]: next }))}
          confirmed={supportConfirmed}
          onConfirmedChange={setSupportConfirmed}
          showRequired={triedToSave}
        />
        {(initial.support_flags ?? []).length > 0 && (
          <ul className="mt-2 space-y-1 text-xs" style={{ color: "var(--text-secondary)" }}>
            {(initial.support_flags ?? []).map((flag, i) => (
              <li key={i}>⚠ {flag}</li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
          Counted once for the whole day. Kept separate from the incident count below.
        </p>
      </section>

      <div
        className="rounded-lg px-4 py-3 text-sm"
        style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}
      >
        <strong className="tnum text-lg">{dayTotal}</strong> incidents counted on this page.
        {flaggedCount > 0 ? (
          <>
            {" "}
            <strong style={{ color: "var(--warning)" }}>
              {flaggedCount} {flaggedCount === 1 ? "row needs" : "rows need"} a second look
            </strong>{" "}
            — they&apos;re outlined below with the reason. Check every number against the photo,
            fix anything wrong, then save.
          </>
        ) : (
          " Check the numbers against the photo, fix anything wrong, then save."
        )}
      </div>

      {periods.map((p, i) => {
        const meta = PERIODS.find((x) => x.key === p.period_key)!;
        const subtotal = KEYS.reduce((acc, k) => acc + p[k], 0);
        const uncertain = p.confidence !== "high";
        const flags = p.flags ?? [];
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
                : uncertain
                  ? { borderColor: "var(--warning)", borderWidth: 2 }
                  : undefined
            }
          >
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold">
                {meta.label}
                <span className="ml-1.5 text-xs font-normal" style={{ color: "var(--text-muted)" }}>
                  {meta.timeRange}
                </span>
              </h3>
              <span className="tnum text-sm" style={{ color: "var(--text-muted)" }}>
                {subtotal}
              </span>
            </div>

            {uncertain && flags.length === 0 && (
              <p className="mb-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                ⚠ Hard to read — please double-check this row.
              </p>
            )}

            {flags.length > 0 && (
              <ul
                className="mb-2 space-y-1 rounded-lg px-2.5 py-2 text-xs"
                style={{ background: "var(--page)", color: "var(--text-secondary)" }}
              >
                {flags.map((flag, fi) => (
                  <li key={fi}>⚠ {flag}</li>
                ))}
              </ul>
            )}

            {p.raw_tally && (
              <p className="mb-2 rounded px-2 py-1 text-xs" style={{ background: "var(--page)", color: "var(--text-secondary)" }}>
                Marks seen on the page: <span className="font-mono">{p.raw_tally}</span>
              </p>
            )}

            <label className="mb-2 flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
              <input
                type="checkbox"
                checked={p.not_observed}
                onChange={(e) => update(i, { not_observed: e.target.checked })}
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
                    value={p[`b${b.code}` as (typeof KEYS)[number]]}
                    onChange={(next) => update(i, { [`b${b.code}`]: next } as Partial<PeriodEntry>)}
                  />
                ))}
              </div>
            )}

            {p.period_key === "specials" && (
              <input
                type="text"
                value={p.specials_subject ?? ""}
                onChange={(e) => update(i, { specials_subject: e.target.value || null })}
                placeholder="Which special? (Library, PE, Music…)"
                className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: "var(--border)", background: "transparent", color: "var(--text-primary)" }}
              />
            )}

            <textarea
              value={p.notes ?? ""}
              onChange={(e) => update(i, { notes: e.target.value || null })}
              placeholder="Teacher's notes for this period"
              rows={2}
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)", background: "transparent", color: "var(--text-primary)" }}
            />
          </section>
        );
      })}

      <section className="card p-4">
        <label className="block text-sm font-medium" htmlFor="overall-note">
          Anything else on the page
        </label>
        <textarea
          id="overall-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Week heading, margin note, scoring key…"
          className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "var(--border)", background: "transparent", color: "var(--text-primary)" }}
        />
      </section>

      {error && (
        <p className="rounded-lg px-4 py-3 text-sm" style={{ background: "var(--surface-1)", color: "var(--critical)" }}>
          {error}
        </p>
      )}

      {confirmReplace ? (
        <div className="card space-y-3 p-4">
          <p className="text-sm">
            There&apos;s already a log saved for {date}. Replace it with this one?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void save(true)}
              disabled={saving}
              className="flex-1 rounded-full py-3 text-sm font-medium text-white disabled:opacity-50"
              style={{ background: "var(--critical)" }}
            >
              Replace it
            </button>
            <button
              type="button"
              onClick={() => setConfirmReplace(false)}
              className="flex-1 rounded-full border py-3 text-sm font-medium"
              style={{ borderColor: "var(--border)" }}
            >
              Keep both — change date
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void save(false)}
          disabled={saving}
          className="sticky bottom-20 w-full rounded-full py-4 text-base font-semibold text-white shadow-lg disabled:opacity-50"
          style={{ background: supportNeedsTick ? "var(--text-muted)" : BEHAVIORS[0].color }}
        >
          {saving
            ? "Saving…"
            : supportNeedsTick
              ? "Confirm the assistance and removal counts first"
              : `Save ${dayTotal} incidents for ${date}`}
        </button>
      )}
    </div>
  );
}
