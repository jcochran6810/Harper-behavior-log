import Link from "next/link";
import Nav from "@/components/Nav";
import {
  BehaviorLegend,
  BehaviorMiniChart,
  PeriodHeatmap,
  StackedByBehaviorChart,
  StatTile,
  TotalPerDayChart,
  weekdayDate,
} from "@/components/charts";
import { BEHAVIORS } from "@/lib/behaviors";
import {
  getBehaviorDaily,
  getDailyTotals,
  getPeriodBehavior,
  getPeriodTotals,
} from "@/lib/queries";
import { pct, summarize } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [totals, behaviorDaily, periodTotals, periodBehavior] = await Promise.all([
    getDailyTotals(),
    getBehaviorDaily(),
    getPeriodTotals(),
    getPeriodBehavior(),
  ]);

  const s = summarize(totals, behaviorDaily, periodTotals);
  const dates = totals.map((d) => d.log_date);
  const countsByCode = new Map<number, Map<string, number>>();
  for (const row of behaviorDaily) {
    if (!countsByCode.has(row.code)) countsByCode.set(row.code, new Map());
    countsByCode.get(row.code)!.set(row.log_date, row.count);
  }

  if (s.days === 0) {
    return (
      <>
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="text-xl font-semibold">No logs yet</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm" style={{ color: "var(--text-secondary)" }}>
            Take a photo of today&apos;s behavior log and it&apos;ll land here as charts and tables.
          </p>
          <Link
            href="/upload"
            className="mt-6 inline-block rounded-full px-6 py-3 text-sm font-medium"
            style={{ background: BEHAVIORS[0].color, color: "#fff" }}
          >
            Add the first log
          </Link>
        </main>
        <Nav />
      </>
    );
  }

  return (
    <>
      <main className="mx-auto max-w-3xl px-4 pb-8 pt-6">
        <header className="mb-6">
          <h1 className="text-xl font-semibold">Behavior Log</h1>
          <p className="mt-0.5 text-sm" style={{ color: "var(--text-muted)" }}>
            {s.firstDate && s.lastDate
              ? `${weekdayDate(s.firstDate)} – ${weekdayDate(s.lastDate)} · ${s.days} school ${s.days === 1 ? "day" : "days"}`
              : null}
          </p>
        </header>

        {/* Hero figure — the one number this whole thing exists to establish. */}
        <section className="card mb-4 p-5">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Recorded incidents
          </p>
          <p className="mt-1 text-5xl font-semibold leading-none">{s.total}</p>
          <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            {s.perDay} per school day across {s.days} {s.days === 1 ? "day" : "days"}
          </p>
        </section>

        <section className="mb-6 grid grid-cols-2 gap-3">
          <StatTile
            label="Hardest day"
            value={s.worstDay ? s.worstDay.total : "—"}
            note={s.worstDay ? weekdayDate(s.worstDay.log_date) : undefined}
          />
          <StatTile
            label="Most frequent"
            value={s.topBehaviors[0]?.total ?? 0}
            note={s.topBehaviors[0]?.label}
          />
          <StatTile
            label="Hardest class"
            value={s.topPeriods[0]?.total ?? 0}
            note={s.topPeriods[0]?.period_label}
          />
          <StatTile
            label="In the top 3 classes"
            value={pct(s.concentration)}
            note="of all incidents"
          />
        </section>

        <section className="card mb-4 p-4">
          <h2 className="text-sm font-semibold">Total incidents per day</h2>
          <p className="mb-2 text-xs" style={{ color: "var(--text-muted)" }}>
            Every behavior type combined.
          </p>
          <TotalPerDayChart data={totals} />
        </section>

        <section className="card mb-4 p-4">
          <h2 className="text-sm font-semibold">What made up each day</h2>
          <p className="mb-2 text-xs" style={{ color: "var(--text-muted)" }}>
            The same daily totals, split by behavior type.
          </p>
          <StackedByBehaviorChart totals={totals} behaviorDaily={behaviorDaily} />
          <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--border)" }}>
            <BehaviorLegend />
          </div>
        </section>

        <section className="card mb-4 p-4">
          <h2 className="text-sm font-semibold">Which class period is hardest</h2>
          <p className="mb-3 text-xs" style={{ color: "var(--text-muted)" }}>
            Every incident recorded so far, by class and behavior number. Darker means more.
          </p>
          <PeriodHeatmap periodTotals={periodTotals} periodBehavior={periodBehavior} />
        </section>

        <section className="mb-4">
          <h2 className="mb-1 px-1 text-sm font-semibold">Each behavior over time</h2>
          <p className="mb-3 px-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Same scale within each chart, not across them.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {BEHAVIORS.map((b) => {
              const map = countsByCode.get(b.code) ?? new Map();
              const values = dates.map((d) => map.get(d) ?? 0);
              const total = values.reduce((x, y) => x + y, 0);
              return (
                <div key={b.code} className="card p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="flex items-center gap-1.5 text-xs font-medium">
                      <span
                        aria-hidden
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ background: b.color }}
                      />
                      {b.code}. {b.short}
                    </h3>
                    <span className="tnum text-sm font-semibold">{total}</span>
                  </div>
                  <BehaviorMiniChart code={b.code} dates={dates} values={values} />
                </div>
              );
            })}
          </div>
        </section>

        <p className="px-1 text-xs" style={{ color: "var(--text-muted)" }}>
          Every number above is also readable as text in the{" "}
          <Link href="/data" className="underline">
            table
          </Link>
          , and printable from the{" "}
          <Link href="/report" className="underline">
            report
          </Link>
          .
        </p>
      </main>
      <Nav />
    </>
  );
}
