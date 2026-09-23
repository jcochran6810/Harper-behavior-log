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
  /** Read out of the teacher's prose, once for the day. Always confirmed by a human. */
  assistance_count: number;
  removed_count: number;
  /** Ticked on the review screen. Never set on the reviewer's behalf. */
  support_confirmed?: boolean;
  /** Why those two want checking — review-time only, never stored. */
  support_flags?: string[];
};

export type DailyTotal = {
  log_date: string;
  day_of_week: string | null;
  date_confirmed: boolean;
  /** Has a human checked this day's numbers against the original page? */
  verified: boolean;
  total: number;
  periods_with_incidents: number;
  smileys: number;
  /** Times another adult was called in, and times she left the room, that day. */
  assistance: number;
  removed: number;
  /** Has a human ticked those two as correct? */
  support_confirmed: boolean;
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
  /**
   * When a human last confirmed this day against the paper. Null means the
   * numbers are still only a transcription — true of every day seeded before
   * the app existed, and the distinction an IEP packet needs to be able to make.
   */
  verified_at: string | null;
  verified_note: string | null;
  /**
   * Counted once for the whole day, from the box at the top of the form: how many
   * times another adult was called into the room, and how many times Harper was
   * taken out of it. Neither is a behavior and neither is ever added to an
   * incident total. See SUPPORT_EVENTS in lib/behaviors.ts.
   */
  assistance_count: number;
  removed_count: number;
  /**
   * When a human ticked "these two are right". Null means nobody has.
   *
   * Separate from `verified_at`, which says the whole DAY was checked against the
   * page. These two are the only numbers in the app read out of the teacher's
   * sentences rather than counted off her tally marks, so it is worth being able
   * to say which of them a parent specifically stood behind.
   */
  support_confirmed_at: string | null;
  overall_note: string | null;
  image_path: string | null;
  harper_log_periods: (PeriodEntry & { id: string; total: number })[];
};
