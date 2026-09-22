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
}: {
  values: Partial<Values>;
  onChange: (key: SupportKey, next: number) => void;
}) {
  return (
    <div
      className="mt-2 rounded-lg border px-3 py-1.5"
      style={{ borderColor: "var(--border)" }}
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
