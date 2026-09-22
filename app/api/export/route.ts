import { PERIOD_KEYS, periodLabel } from "@/lib/behaviors";
import { buildDataset } from "@/lib/derive";
import { activeCount, parseFilters, type SearchParams } from "@/lib/filters";
import { getLogs } from "@/lib/queries";

export const runtime = "nodejs";

function cell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * One row per period per day — the long format a spreadsheet, an advocate, or a
 * school psychologist can pivot however they like. Honors the same filters as
 * the on-screen views, so a download always matches what was showing.
 */
export async function GET(request: Request) {
  const params: SearchParams = Object.fromEntries(new URL(request.url).searchParams);
  const filters = parseFilters(params);
  const data = buildDataset(await getLogs(), filters);

  const header = [
    "date", "day", "period", "specials_subject", "antecedent",
    ...data.behaviors.map((b) => b.short.toLowerCase().replace(/\s+/g, "_")),
    "period_total", "smileys", "not_observed", "confidence", "raw_tally", "notes",
    // Day attributes, so they repeat down the day's ten rows exactly as `date`
    // does. The day_ prefix is the warning not to sum them.
    "day_assistance_called", "day_removed_from_class",
  ];

  const rows = [header.join(",")];

  for (const log of [...data.logs].reverse()) {
    const periods = [...log.harper_log_periods].sort(
      (a, b) => PERIOD_KEYS.indexOf(a.period_key) - PERIOD_KEYS.indexOf(b.period_key),
    );
    for (const p of periods) {
      rows.push(
        [
          log.log_date,
          log.day_of_week ?? "",
          periodLabel(p.period_key),
          p.specials_subject ?? "",
          p.antecedent ?? "",
          ...data.behaviors.map((b) => p[`b${b.code}` as "b1"]),
          p.total,
          p.smiley_count,
          p.not_observed ? "yes" : "no",
          p.confidence,
          p.raw_tally ?? "",
          p.notes ?? "",
          log.assistance_count ?? 0,
          log.removed_count ?? 0,
        ]
          .map(cell)
          .join(","),
      );
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const suffix = activeCount(filters) > 0 ? "-filtered" : "";
  return new Response(`﻿${rows.join("\n")}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="behavior-log${suffix}-${today}.csv"`,
    },
  });
}
