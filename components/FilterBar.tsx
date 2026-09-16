"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BEHAVIORS, PERIODS, type BehaviorCode } from "@/lib/behaviors";
import {
  activeCount,
  RANGE_LABELS,
  serializeFilters,
  WEEKDAYS,
  type Filters,
  type RangeKey,
} from "@/lib/filters";

type Props = {
  filters: Filters;
  /** Counts for the "showing X of Y" line. */
  days: number;
  allDays: number;
  incidents: number;
  allIncidents: number;
  children: React.ReactNode;
};

const PRESETS: RangeKey[] = ["all", "7d", "30d", "90d", "month"];

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

function Chip({
  on,
  onClick,
  children,
  dot,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
  dot?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors"
      style={{
        borderColor: on ? "var(--text-primary)" : "var(--border)",
        background: on ? "var(--text-primary)" : "transparent",
        color: on ? "var(--surface-1)" : "var(--text-secondary)",
      }}
    >
      {dot && (
        <span
          aria-hidden
          className="inline-block h-2 w-2 shrink-0 rounded-sm"
          style={{ background: dot, outline: on ? "1px solid var(--surface-1)" : "none" }}
        />
      )}
      {children}
    </button>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p
        className="mb-2 text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

export default function FilterBar({
  filters,
  days,
  allDays,
  incidents,
  allIncidents,
  children,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const active = activeCount(filters);

  function apply(next: Filters) {
    const query = serializeFilters(next);
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  const setRange = (range: RangeKey) =>
    apply({ ...filters, range, ...(range === "custom" ? {} : { from: null, to: null }) });

  const setCustom = (key: "from" | "to", value: string) =>
    apply({ ...filters, range: "custom", [key]: value || null });

  return (
    <>
      <div
        className="no-print sticky z-20 -mx-4 mb-4 border-b px-4 pb-3 pt-2"
        style={{
          top: "0px",
          background: "var(--page)",
          borderColor: "var(--border)",
        }}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium"
            style={{
              borderColor: active ? "var(--text-primary)" : "var(--border)",
              background: "var(--surface-1)",
              color: "var(--text-primary)",
            }}
          >
            Filters
            {active > 0 && (
              <span
                className="tnum inline-grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-semibold"
                style={{ background: BEHAVIORS[0].color, color: "#fff" }}
              >
                {active}
              </span>
            )}
            <span aria-hidden style={{ color: "var(--text-muted)" }}>
              {open ? "▴" : "▾"}
            </span>
          </button>

          <span className="flex-1" />

          {active > 0 && (
            <button
              type="button"
              onClick={() => apply({ range: "all", from: null, to: null, behaviors: [], periods: [], weekdays: [] })}
              className="shrink-0 text-xs underline"
              style={{ color: "var(--text-secondary)" }}
            >
              Reset
            </button>
          )}
        </div>

        <p className="tnum mt-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
          {days === allDays && incidents === allIncidents ? (
            <>
              {allDays} {allDays === 1 ? "day" : "days"} · {allIncidents} incidents
            </>
          ) : (
            <>
              {days} of {allDays} {allDays === 1 ? "day" : "days"} · {incidents} of{" "}
              {allIncidents} incidents
            </>
          )}
        </p>

        {open && (
          <div className="mt-3 grid gap-4">
            <Group label="When">
              {PRESETS.map((key) => (
                <Chip key={key} on={filters.range === key} onClick={() => setRange(key)}>
                  {RANGE_LABELS[key]}
                </Chip>
              ))}
              <span className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 pt-1">
                {(["from", "to"] as const).map((key) => (
                  <label key={key} className="flex items-center gap-1.5 text-xs">
                    <span className="capitalize" style={{ color: "var(--text-muted)" }}>
                      {key}
                    </span>
                    <input
                      type="date"
                      value={filters[key] ?? ""}
                      onChange={(e) => setCustom(key, e.target.value)}
                      className="rounded-lg border px-2.5 py-1.5 text-xs"
                      style={{
                        borderColor: "var(--border)",
                        background: "var(--surface-1)",
                        color: "var(--text-primary)",
                      }}
                    />
                  </label>
                ))}
              </span>
            </Group>

            <Group label="Behavior">
              {BEHAVIORS.map((b) => (
                <Chip
                  key={b.code}
                  dot={b.color}
                  on={filters.behaviors.includes(b.code)}
                  onClick={() =>
                    apply({ ...filters, behaviors: toggle<BehaviorCode>(filters.behaviors, b.code).sort((x, y) => x - y) })
                  }
                >
                  {b.code}. {b.short}
                </Chip>
              ))}
            </Group>

            <Group label="Class / time of day">
              {PERIODS.map((p) => (
                <Chip
                  key={p.key}
                  on={filters.periods.includes(p.key)}
                  onClick={() => apply({ ...filters, periods: toggle(filters.periods, p.key) })}
                >
                  {p.label}
                  <span style={{ opacity: 0.65 }}>{p.timeRange}</span>
                </Chip>
              ))}
            </Group>

            <Group label="Day of week">
              {WEEKDAYS.map((d) => (
                <Chip
                  key={d}
                  on={filters.weekdays.includes(d)}
                  onClick={() => apply({ ...filters, weekdays: toggle(filters.weekdays, d) })}
                >
                  {d}
                </Chip>
              ))}
            </Group>

            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Nothing selected in a group means all of it. Filters apply to the charts, the
              table, the report and the CSV alike.
            </p>
          </div>
        )}
      </div>

      <div
        style={{
          opacity: pending ? 0.45 : 1,
          transition: "opacity 140ms ease",
        }}
      >
        {children}
      </div>
    </>
  );
}
