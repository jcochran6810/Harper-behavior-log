import { BEHAVIORS, PERIOD_KEYS, type BehaviorCode } from "./behaviors";

/**
 * Every view is scoped by the same filter set, carried in the URL so a filtered
 * view can be bookmarked, shared, or handed to the school as a link.
 * An empty array always means "all of them", never "none of them".
 */
export type Filters = {
  range: RangeKey;
  from: string | null;
  to: string | null;
  behaviors: BehaviorCode[];
  periods: string[];
  weekdays: string[];
};

export const RANGE_KEYS = ["all", "7d", "30d", "90d", "month", "custom"] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];

export const RANGE_LABELS: Record<RangeKey, string> = {
  all: "All time",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  month: "This month",
  custom: "Custom",
};

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const EMPTY_FILTERS: Filters = {
  range: "all",
  from: null,
  to: null,
  behaviors: [],
  periods: [],
  weekdays: [],
};

/** Weekday of a log date, computed from the date rather than the stored text. */
export function weekdayOf(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
}

function todayISO(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function shiftDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function list(value: string | string[] | undefined): string[] {
  return first(value)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export type SearchParams = Record<string, string | string[] | undefined>;

export function parseFilters(params: SearchParams): Filters {
  const rangeRaw = first(params.range) as RangeKey;
  const range = (RANGE_KEYS as readonly string[]).includes(rangeRaw) ? rangeRaw : "all";

  const from = DATE_RE.test(first(params.from)) ? first(params.from) : null;
  const to = DATE_RE.test(first(params.to)) ? first(params.to) : null;

  const behaviors = list(params.b)
    .map(Number)
    .filter((n): n is BehaviorCode => BEHAVIORS.some((x) => x.code === n))
    .sort((a, b) => a - b);

  const periods = list(params.p).filter((k) => PERIOD_KEYS.includes(k));
  const weekdays = list(params.d).filter((k) => (WEEKDAYS as readonly string[]).includes(k));

  return { range, from, to, behaviors, periods, weekdays };
}

/** Back to a query string — omitting anything at its default. */
export function serializeFilters(filters: Filters): string {
  const params = new URLSearchParams();
  if (filters.range !== "all") params.set("range", filters.range);
  if (filters.range === "custom") {
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
  }
  if (filters.behaviors.length) params.set("b", filters.behaviors.join(","));
  if (filters.periods.length) params.set("p", filters.periods.join(","));
  if (filters.weekdays.length) params.set("d", filters.weekdays.join(","));
  return params.toString();
}

/** The concrete date window a range key stands for. */
export function resolveRange(filters: Filters): { from: string | null; to: string | null } {
  const today = todayISO();
  switch (filters.range) {
    case "7d":
      return { from: shiftDays(today, -6), to: today };
    case "30d":
      return { from: shiftDays(today, -29), to: today };
    case "90d":
      return { from: shiftDays(today, -89), to: today };
    case "month":
      return { from: `${today.slice(0, 7)}-01`, to: today };
    case "custom":
      return { from: filters.from, to: filters.to };
    default:
      return { from: null, to: null };
  }
}

export function activeCount(filters: Filters): number {
  let n = 0;
  if (filters.range !== "all") n++;
  if (filters.behaviors.length) n++;
  if (filters.periods.length) n++;
  if (filters.weekdays.length) n++;
  return n;
}

/** One-line description of the slice, for the printed report's header. */
export function describeFilters(filters: Filters): string | null {
  const parts: string[] = [];

  if (filters.range !== "all") {
    const { from, to } = resolveRange(filters);
    parts.push(
      filters.range === "custom"
        ? `${from ?? "start"} to ${to ?? "today"}`
        : RANGE_LABELS[filters.range].toLowerCase(),
    );
  }
  if (filters.behaviors.length) {
    parts.push(
      `only ${filters.behaviors
        .map((c) => BEHAVIORS.find((b) => b.code === c)?.short.toLowerCase())
        .join(", ")}`,
    );
  }
  if (filters.periods.length) {
    parts.push(`${filters.periods.length} of ${PERIOD_KEYS.length} class periods`);
  }
  if (filters.weekdays.length) {
    parts.push(filters.weekdays.join(", ") + " only");
  }

  return parts.length ? parts.join(" · ") : null;
}
