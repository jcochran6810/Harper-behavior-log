import { BEHAVIORS, PERIOD_KEYS, periodLabel } from "@/lib/behaviors";
import { getLogs } from "@/lib/queries";

export const runtime = "nodejs";

function cell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * One row per period per day — the long format a spreadsheet, an advocate, or a
 * school psychologist can pivot however they like.
 */
export async function GET() {
  const logs = await getLogs();

  const header = [
    "date", "day", "period", "specials_subject", "antecedent",
    ...BEHAVIORS.map((b) => b.short.toLowerCase().replace(/\s+/g, "_")),
    "period_total", "smileys", "not_observed", "confidence", "raw_tally", "notes",
  ];

  const rows = [header.join(",")];

  for (const log of [...logs].reverse()) {
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
          p.b1, p.b2, p.b3, p.b4, p.b5, p.b6, p.b7, p.b8,
          p.total,
          p.smiley_count,
          p.not_observed ? "yes" : "no",
          p.confidence,
          p.raw_tally ?? "",
          p.notes ?? "",
        ]
          .map(cell)
          .join(","),
      );
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  return new Response(`﻿${rows.join("\n")}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="behavior-log-${today}.csv"`,
    },
  });
}
