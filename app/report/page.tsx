import Nav from "@/components/Nav";
import PrintButton from "@/components/PrintButton";
import { PeriodHeatmap, TotalPerDayChart, weekdayDate } from "@/components/charts";
import { BEHAVIORS, PERIOD_KEYS, periodLabel } from "@/lib/behaviors";
import {
  getBehaviorDaily,
  getDailyTotals,
  getLogs,
  getPeriodBehavior,
  getPeriodTotals,
} from "@/lib/queries";
import { pct, summarize } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function ReportPage() {
  const [totals, behaviorDaily, periodTotals, periodBehavior, logs] = await Promise.all([
    getDailyTotals(),
    getBehaviorDaily(),
    getPeriodTotals(),
    getPeriodBehavior(),
    getLogs(),
  ]);

  const s = summarize(totals, behaviorDaily, periodTotals);
  const observedPeriods = periodTotals.filter((p) => p.days_recorded > 0);
  const printedOn = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (s.days === 0) {
    return (
      <>
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Add at least one log and the report will build itself.
          </p>
        </main>
        <Nav />
      </>
    );
  }

  return (
    <>
      <main className="mx-auto max-w-3xl px-4 pb-8 pt-6">
        <div className="no-print mb-6 flex items-center justify-between gap-3">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Print this, or save it as a PDF, to bring to the meeting.
          </p>
          <PrintButton />
        </div>

        <header className="mb-6">
          <h1 className="text-2xl font-semibold">Classroom Behavior Summary</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            {s.firstDate && s.lastDate
              ? `Observation period: ${weekdayDate(s.firstDate)} through ${weekdayDate(s.lastDate)} · ${s.days} school ${s.days === 1 ? "day" : "days"}`
              : null}
          </p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Compiled {printedOn} from the daily behavior logs sent home by the classroom teacher.
          </p>
        </header>

        <section className="card mb-5 p-5">
          <h2 className="mb-3 text-base font-semibold">What the logs show</h2>
          <ul className="space-y-2 text-sm leading-relaxed">
            <li>
              <strong className="tnum">{s.total} documented incidents</strong> across {s.days}{" "}
              school {s.days === 1 ? "day" : "days"} — an average of{" "}
              <strong className="tnum">{s.perDay} per day</strong>.
            </li>
            {s.worstDay && (
              <li>
                The hardest single day was {weekdayDate(s.worstDay.log_date)} with{" "}
                <strong className="tnum">{s.worstDay.total} incidents</strong> recorded across{" "}
                {s.worstDay.periods_with_incidents} class{" "}
                {s.worstDay.periods_with_incidents === 1 ? "period" : "periods"}.
              </li>
            )}
            {s.topPeriods[0] && (
              <li>
                Incidents concentrate in a small number of class periods:{" "}
                <strong>{pct(s.concentration)}</strong> of everything recorded happened during{" "}
                {s.topPeriods
                  .slice(0, 3)
                  .map((p) => p.period_label)
                  .join(", ")}
                .
              </li>
            )}
            {s.topBehaviors[0] && s.topBehaviors[1] && (
              <li>
                The two most frequent behaviors are{" "}
                <strong>{s.topBehaviors[0].label.toLowerCase()}</strong> (
                <span className="tnum">{s.topBehaviors[0].total}</span>) and{" "}
                <strong>{s.topBehaviors[1].label.toLowerCase()}</strong> (
                <span className="tnum">{s.topBehaviors[1].total}</span>), together{" "}
                {pct(s.topBehaviors[0].share + s.topBehaviors[1].share)} of all incidents.
              </li>
            )}
            <li style={{ color: "var(--text-secondary)" }}>
              Counts come from the tally marks the classroom teacher recorded on the daily log
              form. Each day was transcribed from the original page and checked by a parent
              against the photograph before being entered.
            </li>
          </ul>
        </section>

        <section className="card mb-5 p-4">
          <h2 className="mb-1 text-base font-semibold">Incidents per school day</h2>
          <p className="mb-2 text-xs" style={{ color: "var(--text-muted)" }}>
            All behavior types combined.
          </p>
          <TotalPerDayChart data={totals} />
        </section>

        <section className="card mb-5 p-4">
          <h2 className="mb-3 text-base font-semibold">By behavior type</h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr style={{ color: "var(--text-muted)" }}>
                <th scope="col" className="py-2 text-left text-xs font-medium">
                  Behavior
                </th>
                <th scope="col" className="py-2 text-right text-xs font-medium">
                  Total
                </th>
                <th scope="col" className="py-2 text-right text-xs font-medium">
                  Share
                </th>
                <th scope="col" className="py-2 text-right text-xs font-medium">
                  Per day
                </th>
              </tr>
            </thead>
            <tbody>
              {s.topBehaviors.map((b) => (
                <tr key={b.code} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <th scope="row" className="py-2 text-left font-normal">
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ background: b.color }}
                      />
                      {b.code}. {b.label}
                    </span>
                  </th>
                  <td className="tnum py-2 text-right font-semibold">{b.total}</td>
                  <td className="tnum py-2 text-right" style={{ color: "var(--text-secondary)" }}>
                    {pct(b.share)}
                  </td>
                  <td className="tnum py-2 text-right" style={{ color: "var(--text-secondary)" }}>
                    {(b.total / s.days).toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card mb-5 p-4">
          <h2 className="mb-1 text-base font-semibold">By class period</h2>
          <p className="mb-3 text-xs" style={{ color: "var(--text-muted)" }}>
            Columns are the numbered behaviors from the log form. This is where support staffing
            would have the most effect.
          </p>
          <PeriodHeatmap periodTotals={observedPeriods} periodBehavior={periodBehavior} />
        </section>

        <section className="print-break">
          <h2 className="mb-3 text-base font-semibold">Daily record with teacher&apos;s notes</h2>
          <div className="space-y-3">
            {[...logs].reverse().map((log) => {
              const periods = [...log.harper_log_periods].sort(
                (a, b) => PERIOD_KEYS.indexOf(a.period_key) - PERIOD_KEYS.indexOf(b.period_key),
              );
              const total = periods.reduce((sum, p) => sum + p.total, 0);
              return (
                <article key={log.id} className="card p-4">
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <h3 className="font-semibold">{weekdayDate(log.log_date)}</h3>
                    <span className="tnum text-sm" style={{ color: "var(--text-secondary)" }}>
                      {total} incidents
                    </span>
                  </div>
                  <table className="w-full border-collapse text-sm">
                    <tbody>
                      {periods.map((p) => {
                        const active = BEHAVIORS.filter(
                          (b) => p[`b${b.code}` as "b1"] > 0,
                        );
                        if (!p.notes && active.length === 0 && !p.not_observed) return null;
                        return (
                          <tr key={p.id} className="border-t align-top" style={{ borderColor: "var(--border)" }}>
                            <th
                              scope="row"
                              className="w-32 py-2 pr-3 text-left text-xs font-medium"
                            >
                              {periodLabel(p.period_key)}
                              {p.specials_subject ? ` (${p.specials_subject})` : ""}
                            </th>
                            <td className="py-2 text-xs">
                              {active.length > 0 && (
                                <p className="mb-1">
                                  {active
                                    .map((b) => `${b.short} ×${p[`b${b.code}` as "b1"]}`)
                                    .join(" · ")}
                                </p>
                              )}
                              <p style={{ color: "var(--text-secondary)" }}>
                                {p.notes ?? (p.not_observed ? "Not observed." : "")}
                              </p>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </article>
              );
            })}
          </div>
        </section>
      </main>
      <Nav />
    </>
  );
}
