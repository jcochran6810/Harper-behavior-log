import "server-only";
import { db } from "./supabase";
import type {
  BehaviorDaily,
  DailyTotal,
  LogWithPeriods,
  PeriodBehavior,
  PeriodTotal,
} from "./types";

export async function getDailyTotals(): Promise<DailyTotal[]> {
  const { data, error } = await db()
    .from("harper_v_daily_totals")
    .select("*")
    .order("log_date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as DailyTotal[];
}

export async function getBehaviorDaily(): Promise<BehaviorDaily[]> {
  const { data, error } = await db()
    .from("harper_v_behavior_daily")
    .select("*")
    .order("log_date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as BehaviorDaily[];
}

export async function getPeriodTotals(): Promise<PeriodTotal[]> {
  const { data, error } = await db()
    .from("harper_v_period_totals")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as PeriodTotal[];
}

export async function getPeriodBehavior(): Promise<PeriodBehavior[]> {
  const { data, error } = await db().from("harper_v_period_behavior").select("*");
  if (error) throw new Error(error.message);
  return (data ?? []) as PeriodBehavior[];
}

const LOG_COLUMNS = `
  id, log_date, day_of_week, date_confirmed, overall_note, image_path,
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

export async function getLogByDate(date: string): Promise<{ id: string } | null> {
  const { data, error } = await db()
    .from("harper_daily_logs")
    .select("id")
    .eq("log_date", date)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}
