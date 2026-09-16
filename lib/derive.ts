import { BEHAVIORS, PERIODS, type Behavior, type BehaviorCode, type Period } from "./behaviors";
import { resolveRange, weekdayOf, type Filters } from "./filters";
import type {
  BehaviorDaily,
  DailyTotal,
  LogWithPeriods,
  PeriodBehavior,
  PeriodEntry,
  PeriodTotal,
} from "./types";

export type Dataset = {
  /** Filtered logs, newest first, with non-matching period rows removed. */
  logs: LogWithPeriods[];
  /** Oldest first — charts read left to right. */
  dailyTotals: DailyTotal[];
  behaviorDaily: BehaviorDaily[];
  periodTotals: PeriodTotal[];
  periodBehavior: PeriodBehavior[];
  /** The behaviors and periods in play, in their canonical order. */
  behaviors: Behavior[];
  periods: Period[];
  /** Totals before filtering, so the UI can say "12 of 40 days". */
  allDays: number;
  allIncidents: number;
};

function countIn(period: PeriodEntry, codes: BehaviorCode[]): number {
  let sum = 0;
  for (const code of codes) sum += period[`b${code}` as "b1"];
  return sum;
}

export function selectedBehaviors(filters: Filters): Behavior[] {
  return filters.behaviors.length
    ? BEHAVIORS.filter((b) => filters.behaviors.includes(b.code))
    : BEHAVIORS;
}

export function selectedPeriods(filters: Filters): Period[] {
  return filters.periods.length
    ? PERIODS.filter((p) => filters.periods.includes(p.key))
    : PERIODS;
}

export function buildDataset(all: LogWithPeriods[], filters: Filters): Dataset {
  const behaviors = selectedBehaviors(filters);
  const periods = selectedPeriods(filters);
  const codes = behaviors.map((b) => b.code);
  const periodKeys = new Set(periods.map((p) => p.key));
  const { from, to } = resolveRange(filters);

  const allIncidents = all.reduce(
    (sum, log) => sum + log.harper_log_periods.reduce((acc, p) => acc + p.total, 0),
    0,
  );

  // 1. Which days survive — date window and day of week.
  const days = all.filter((log) => {
    if (from && log.log_date < from) return false;
    if (to && log.log_date > to) return false;
    if (filters.weekdays.length && !filters.weekdays.includes(weekdayOf(log.log_date))) return false;
    return true;
  });

  // 2. Within each day, which period rows survive — and recount their totals
  //    against only the selected behaviors.
  const logs: LogWithPeriods[] = days.map((log) => ({
    ...log,
    harper_log_periods: log.harper_log_periods
      .filter((p) => periodKeys.has(p.period_key))
      .map((p) => ({ ...p, total: countIn(p, codes) })),
  }));

  const ascending = [...logs].sort((a, b) => a.log_date.localeCompare(b.log_date));

  const dailyTotals: DailyTotal[] = ascending.map((log) => ({
    log_date: log.log_date,
    day_of_week: log.day_of_week ?? weekdayOf(log.log_date),
    date_confirmed: log.date_confirmed,
    total: log.harper_log_periods.reduce((sum, p) => sum + p.total, 0),
    periods_with_incidents: log.harper_log_periods.filter((p) => p.total > 0).length,
    smileys: log.harper_log_periods.reduce((sum, p) => sum + p.smiley_count, 0),
  }));

  const behaviorDaily: BehaviorDaily[] = [];
  for (const log of ascending) {
    for (const b of behaviors) {
      const count = log.harper_log_periods.reduce(
        (sum, p) => sum + p[`b${b.code}` as "b1"],
        0,
      );
      behaviorDaily.push({
        log_date: log.log_date,
        code: b.code,
        short_label: b.short,
        color: b.color,
        count,
      });
    }
  }

  const periodTotals: PeriodTotal[] = periods.map((meta) => {
    const rows = logs.flatMap((log) =>
      log.harper_log_periods.filter((p) => p.period_key === meta.key),
    );
    return {
      period_key: meta.key,
      period_label: meta.label,
      time_range: meta.timeRange,
      sort_order: meta.order,
      total: rows.reduce((sum, p) => sum + p.total, 0),
      days_recorded: rows.length,
      smileys: rows.reduce((sum, p) => sum + p.smiley_count, 0),
    };
  });

  const periodBehavior: PeriodBehavior[] = [];
  for (const meta of periods) {
    const rows = logs.flatMap((log) =>
      log.harper_log_periods.filter((p) => p.period_key === meta.key),
    );
    for (const b of behaviors) {
      periodBehavior.push({
        period_key: meta.key,
        period_label: meta.label,
        sort_order: meta.order,
        code: b.code,
        short_label: b.short,
        count: rows.reduce((sum, p) => sum + p[`b${b.code}` as "b1"], 0),
      });
    }
  }

  return {
    logs,
    dailyTotals,
    behaviorDaily,
    periodTotals,
    periodBehavior,
    behaviors,
    periods,
    allDays: all.length,
    allIncidents,
  };
}
