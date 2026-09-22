import Link from "next/link";
import { BEHAVIORS, PERIOD_KEYS, periodLabel, type Behavior } from "@/lib/behaviors";
import type { LogWithPeriods } from "@/lib/types";

const KEYS = ["b1", "b2", "b3", "b4", "b5", "b6", "b7", "b8"] as const;

function weekday(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "numeric",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function LogTable({
  logs,
  behaviors = BEHAVIORS,
  query = "",
}: {
  logs: LogWithPeriods[];
  behaviors?: Behavior[];
  /** Current filter query, carried into each day link so the slice survives. */
  query?: string;
}) {
  const dayHref = (log: LogWithPeriods) =>
    query ? `/day/${log.log_date}?${query}` : `/day/${log.log_date}`;

  const dayTotals = (log: LogWithPeriods) =>
    behaviors.map((b) =>
      log.harper_log_periods.reduce((sum, p) => sum + p[`b${b.code}` as (typeof KEYS)[number]], 0),
    );

  return (
    <div className="space-y-6">
      <section className="card overflow-x-auto p-0">
        <table className="w-full min-w-[620px] border-collapse text-sm">
          <caption className="px-4 pb-1 pt-4 text-left text-sm font-semibold">
            Incidents by day and behavior type
          </caption>
          <thead>
            <tr style={{ color: "var(--text-muted)" }}>
              <th scope="col" className="px-4 py-2 text-left text-xs font-medium">
                Date
              </th>
              {behaviors.map((b) => (
                <th
                  key={b.code}
                  scope="col"
                  className="px-1 py-2 text-center text-xs font-medium"
                  title={b.label}
                >
                  <span
                    aria-hidden
                    className="mx-auto mb-1 block h-1.5 w-4 rounded-full"
                    style={{ background: b.color }}
                  />
                  {b.code}
                </th>
              ))}
              <th scope="col" className="px-4 py-2 text-right text-xs font-medium">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => {
              const cells = dayTotals(log);
              const total = cells.reduce((a, b) => a + b, 0);
              return (
                <tr key={log.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <th scope="row" className="whitespace-nowrap px-4 py-2 text-left font-normal">
                    <Link href={dayHref(log)} className="underline underline-offset-2">
                      {weekday(log.log_date)}
                    </Link>
                    {!log.date_confirmed && (
                      <span className="ml-1.5 text-xs" style={{ color: "var(--warning)" }} title="Date was blank on the form">
                        ⚠
                      </span>
                    )}
                    {!log.verified_at && (
                      <span
                        className="ml-1 text-xs"
                        style={{ color: "var(--warning)" }}
                        title="These numbers have not been checked against the original page"
                      >
                        ?
                      </span>
                    )}
                  </th>
                  {cells.map((value, i) => (
                    <td
                      key={i}
                      className="tnum px-1 py-2 text-center"
                      style={{ color: value ? "var(--text-primary)" : "var(--text-muted)" }}
                    >
                      {value || "·"}
                    </td>
                  ))}
                  <td className="tnum px-4 py-2 text-right font-semibold">{total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="px-4 pb-4 pt-2 text-xs" style={{ color: "var(--text-muted)" }}>
          {behaviors.map((b) => `${b.code}. ${b.short}`).join(" · ")}
        </p>
      </section>

      <section>
        <h2 className="mb-2 px-1 text-sm font-semibold">
          Day by day — tap a day for its page and photo
        </h2>
        <div className="space-y-2">
          {logs.map((log) => {
            const periods = [...log.harper_log_periods].sort(
              (a, b) => PERIOD_KEYS.indexOf(a.period_key) - PERIOD_KEYS.indexOf(b.period_key),
            );
            const total = periods.reduce((sum, p) => sum + p.total, 0);
            const busiest = periods
              .filter((p) => p.total > 0)
              .sort((a, b) => b.total - a.total)
              .slice(0, 3);

            return (
              <Link
                key={log.id}
                href={dayHref(log)}
                className="card flex items-center justify-between gap-3 px-4 py-3"
              >
                <span className="min-w-0">
                  <span className="block font-medium">
                    {weekday(log.log_date)}
                    {!log.date_confirmed && (
                      <span
                        className="ml-1.5 text-xs"
                        style={{ color: "var(--warning)" }}
                        title="Date was blank on the form"
                      >
                        ⚠
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-xs" style={{ color: "var(--text-muted)" }}>
                    {log.image_path ? "📄 photo saved · " : "no photo of the page · "}
                    {busiest.length > 0
                      ? busiest.map((p) => `${periodLabel(p.period_key)} ${p.total}`).join(" · ")
                      : "no incidents recorded"}
                  </span>
                  {!log.verified_at && (
                    <span className="mt-1 block text-xs" style={{ color: "var(--warning)" }}>
                      Not yet checked against the paper
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="tnum text-sm" style={{ color: "var(--text-muted)" }}>
                    {total} incidents
                  </span>
                  <span aria-hidden style={{ color: "var(--text-muted)" }}>
                    ›
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
