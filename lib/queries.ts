import "server-only";
import { db } from "./supabase";
import type { LogWithPeriods } from "./types";

/**
 * Every view derives from this one shape. Pulling the whole log set and
 * aggregating in TypeScript (see lib/derive.ts) is what lets one filter set
 * scope the charts, the table, the report and the CSV identically — a few
 * hundred rows a school year, so the SQL-side views aren't worth the divergence.
 */

const LOG_COLUMNS = `
  id, log_date, day_of_week, date_confirmed, overall_note, image_path, row_geometry,
  verified_at, verified_note,
  harper_log_periods (
    id, period_key, specials_subject, antecedent, notes, raw_tally,
    smiley_count, not_observed, confidence, total,
    b1, b2, b3, b4, b5, b6, b7, b8
  )
`;

export async function getLogs(): Promise<LogWithPeriods[]> {
  const { data, error } = await db()
    .from("harper_daily_logs")
    .select(LOG_COLUMNS)
    .order("log_date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as LogWithPeriods[];
}

export async function getLog(id: string): Promise<LogWithPeriods | null> {
  const { data, error } = await db()
    .from("harper_daily_logs")
    .select(LOG_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as LogWithPeriods) ?? null;
}

/** One day, by its date — the day-detail page's single read. */
export async function getLogByDateFull(date: string): Promise<LogWithPeriods | null> {
  const { data, error } = await db()
    .from("harper_daily_logs")
    .select(LOG_COLUMNS)
    .eq("log_date", date)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as LogWithPeriods) ?? null;
}

export async function getLogByDate(date: string): Promise<{ id: string } | null> {
  const { data, error } = await db()
    .from("harper_daily_logs")
    .select("id")
    .eq("log_date", date)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}
