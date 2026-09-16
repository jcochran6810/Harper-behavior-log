import { BEHAVIORS, type Behavior } from "./behaviors";
import type { BehaviorDaily, DailyTotal, PeriodTotal } from "./types";

export type Summary = {
  days: number;
  total: number;
  perDay: string;
  worstDay: DailyTotal | null;
  quietestDay: DailyTotal | null;
  firstDate: string | null;
  lastDate: string | null;
  topBehaviors: { code: number; short: string; label: string; color: string; total: number; share: number }[];
  topPeriods: PeriodTotal[];
  /** Share of all incidents that land in the three worst class periods. */
  concentration: number;
};

export function summarize(
  totals: DailyTotal[],
  behaviorDaily: BehaviorDaily[],
  periodTotals: PeriodTotal[],
  behaviors: Behavior[] = BEHAVIORS,
): Summary {
  const total = totals.reduce((sum, d) => sum + d.total, 0);
  const days = totals.length;

  const perBehavior = behaviors.map((b) => {
    const sum = behaviorDaily
      .filter((row) => row.code === b.code)
      .reduce((acc, row) => acc + row.count, 0);
    return {
      code: b.code,
      short: b.short,
      label: b.label,
      color: b.color,
      total: sum,
      share: total > 0 ? sum / total : 0,
    };
  }).sort((a, b) => b.total - a.total);

  const rankedPeriods = [...periodTotals].sort((a, b) => b.total - a.total);
  const topThree = rankedPeriods.slice(0, 3).reduce((sum, p) => sum + p.total, 0);

  const sortedDays = [...totals].sort((a, b) => b.total - a.total);

  return {
    days,
    total,
    perDay: days > 0 ? (total / days).toFixed(1) : "0",
    worstDay: sortedDays[0] ?? null,
    quietestDay: sortedDays[sortedDays.length - 1] ?? null,
    firstDate: totals[0]?.log_date ?? null,
    lastDate: totals[totals.length - 1]?.log_date ?? null,
    topBehaviors: perBehavior,
    topPeriods: rankedPeriods,
    concentration: total > 0 ? topThree / total : 0,
  };
}

export function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}
