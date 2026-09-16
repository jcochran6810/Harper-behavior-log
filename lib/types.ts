import type { Layout } from "./geometry";

export type PeriodEntry = {
  period_key: string;
  specials_subject: string | null;
  antecedent: string | null;
  notes: string | null;
  raw_tally: string | null;
  smiley_count: number;
  not_observed: boolean;
  confidence: "high" | "medium" | "low";
  b1: number; b2: number; b3: number; b4: number;
  b5: number; b6: number; b7: number; b8: number;
  /**
   * Review-time only — never stored. Notes on how this row's numbers were
   * arrived at and anything that didn't add up, so the review screen can point
   * a human straight at the rows worth re-checking against the photo.
   */
  flags?: string[];
};

export type ParsedLog = {
  log_date: string | null;
  day_of_week: string | null;
  overall_note: string | null;
  periods: PeriodEntry[];
  /** Where each row of the form sits on the photo, for the tappable boxes. */
  layout: Layout;
  /** "estimated" means the grid is an even split and wants aligning by hand. */
  layout_source: "measured" | "estimated";
};

export type DailyTotal = {
  log_date: string;
  day_of_week: string | null;
  date_confirmed: boolean;
  total: number;
  periods_with_incidents: number;
  smileys: number;
};

export type BehaviorDaily = {
  log_date: string;
  code: number;
  short_label: string;
  color: string;
  count: number;
};

export type PeriodTotal = {
  period_key: string;
  period_label: string;
  time_range: string;
  sort_order: number;
  total: number;
  days_recorded: number;
  smileys: number;
};

export type PeriodBehavior = {
  period_key: string;
  period_label: string;
  sort_order: number;
  code: number;
  short_label: string;
  count: number;
};

export type LogWithPeriods = {
  id: string;
  /** Saved row grid for the stored photo; null for days saved before boxes existed. */
  row_geometry: Layout | null;
  log_date: string;
  day_of_week: string | null;
  date_confirmed: boolean;
  overall_note: string | null;
  image_path: string | null;
  harper_log_periods: (PeriodEntry & { id: string; total: number })[];
};
