"use client";

import { SUPPORT_EVENTS, type SupportKey } from "@/lib/behaviors";

/**
 * The two counts that describe what the school had to do, rather than what Harper
 * did: how often another adult was called into the room, and how often she was
 * taken out of it.
 *
 * One box per DAY, shown at the top rather than inside a class period. That is how
 * the paper records them, and it avoids asking anyone to decide which class a
 * removal "belonged" to — a decision the form never makes.
 *
 * Kept apart from the eight behavior counters because they are a different kind of
 * evidence and they come from a different part of the page: the teacher's own
 * count, not her tally marks. Neither is ever added to an incident total.
 *
 * They also carry their own confirmation tick. Every other number here is counted
 * off marks a person can check against the photograph one glyph at a time; these
 * two are read out of sentences, which is a judgement the photo doesn't settle at
 * a glance. So a reviewer says explicitly that they are right, and the app records
 * that separately from "this day was checked".
 */

type Values = Record<SupportKey, number>;

function Stepper({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (next: number) => void;
}) {
  const active = value > 0;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="min-w-0 flex-1">
        <span
          className="block text-xs font-medium"
          style={{ color: active ? "var(--text-primary)" : "var(--text-secondary)" }}
        >
          {label}
        </span>
        <span className="mt-0.5 block text-[11px] leading-snug" style={{ color: "var(--text-muted)" }}>
          {hint}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          aria-label={`One fewer: ${label}`}
          onClick={() => onChange(Math.max(0, value - 1))}
          className="h-8 w-8 rounded border text-lg leading-none active:scale-90"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          −
        </button>
        <span
          className="tnum w-7 text-center text-base font-semibold"
          style={{ color: active ? "var(--text-primary)" : "var(--text-muted)" }}
        >
          {value}
        </span>
        <button
          type="button"
          aria-label={`One more: ${label}`}
          onClick={() => onChange(Math.min(99, value + 1))}
          className="h-8 w-8 rounded border text-lg leading-none active:scale-90"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          +
        </button>
      </span>
    </div>
  );
}

export default function SupportCounters({
  values,
  onChange,
  confirmed,
  onConfirmedChange,
  /** True once the reviewer has tried to save without ticking a required box. */
  showRequired = false,
}: {
  values: Partial<Values>;
  onChange: (key: SupportKey, next: number) => void;
  confirmed?: boolean;
  onConfirmedChange?: (next: boolean) => void;
  showRequired?: boolean;
}) {
  const total = SUPPORT_EVENTS.reduce((sum, e) => sum + (values[e.key] ?? 0), 0);
  // Only a claim needs vouching for. A day where neither happened has nothing to
  // confirm, and demanding a tick on every quiet day would teach people to tick
  // without looking — which is worse than not asking.
  const required = total > 0;
  const missing = showRequired && required && !confirmed;

  return (
    <div
      className="mt-2 rounded-lg border px-3 py-1.5"
      style={{ borderColor: missing ? "var(--warning)" : "var(--border)", borderWidth: missing ? 2 : 1 }}
    >
      <p className="pt-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        What the school had to do
      </p>
      {SUPPORT_EVENTS.map((event) => (
        <Stepper
          key={event.key}
          label={event.label}
          hint={event.hint}
          value={values[event.key] ?? 0}
          onChange={(next) => onChange(event.key, next)}
        />
      ))}

      {onConfirmedChange && (
        <div className="mt-1 border-t pt-2" style={{ borderColor: "var(--border)" }}>
          <label className="flex cursor-pointer items-start gap-2 py-1 text-xs">
            <input
              type="checkbox"
              checked={Boolean(confirmed)}
              onChange={(e) => onConfirmedChange(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0"
            />
            <span style={{ color: "var(--text-secondary)" }}>
              These two numbers are right for this day.
              {required && (
                <span style={{ color: missing ? "var(--warning)" : "var(--text-muted)" }}>
                  {" "}
                  Required, because one of them is above zero.
                </span>
              )}
            </span>
          </label>
          <p className="pb-1 text-[11px] leading-snug" style={{ color: "var(--text-muted)" }}>
            {total > 0
              ? "These are read out of the teacher's wording, not counted off tally marks — so they're the ones worth a second look."
              : "Nothing to confirm on a day with neither. Tick it anyway if you checked."}
          </p>
        </div>
      )}
    </div>
  );
}

/** Read-only chips, shown only when something actually happened. */
export function SupportChips({ values }: { values: Partial<Values> }) {
  const shown = SUPPORT_EVENTS.filter((e) => (values[e.key] ?? 0) > 0);
  if (shown.length === 0) return null;
  return (
    <p className="mt-1.5 flex flex-wrap gap-1.5">
      {shown.map((e) => (
        <span
          key={e.key}
          className="tnum rounded px-1.5 py-0.5 text-xs"
          style={
            e.mark === "solid"
              ? { background: "var(--text-secondary)", color: "var(--page)" }
              : { border: "1px solid var(--text-secondary)", color: "var(--text-secondary)" }
          }
          title={e.hint}
        >
          {e.label} ×{values[e.key]}
        </span>
      ))}
    </p>
  );
}
