import Link from "next/link";
import FilterBar from "@/components/FilterBar";
import Nav from "@/components/Nav";
import PageHeader from "@/components/PageHeader";
import {
  BehaviorLegend,
  BehaviorMiniChart,
  PeriodHeatmap,
  StackedByBehaviorChart,
  StatTile,
  SupportLegend,
  SupportPerDayChart,
  TotalPerDayChart,
  weekdayDate,
} from "@/components/charts";
import { BEHAVIORS, SUPPORT_EVENTS } from "@/lib/behaviors";
import { buildDataset } from "@/lib/derive";
import { activeCount, parseFilters, serializeFilters, type SearchParams } from "@/lib/filters";
import { getLogs } from "@/lib/queries";
import { pct, perDayOf, summarize } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filters = parseFilters(await searchParams);
  const data = buildDataset(await getLogs(), filters);
  const s = summarize(data.dailyTotals, data.behaviorDaily, data.periodTotals, data.behaviors);
  const query = serializeFilters(filters);

  const dates = data.dailyTotals.map((d) => d.log_date);
  const unverified = data.dailyTotals.filter((d) => !d.verified);
  // Only the days something actually happened on, most recent first.
  const supportDays = [...data.dailyTotals]
    .filter((d) => d.assistance > 0 || d.removed > 0)
    .reverse();
  const unconfirmedSupport = supportDays.filter((d) => !d.support_confirmed).length;
  const countsByCode = new Map<number, Map<string, number>>();
  for (const row of data.behaviorDaily) {
    if (!countsByCode.has(row.code)) countsByCode.set(row.code, new Map());
    countsByCode.get(row.code)!.set(row.log_date, row.count);
  }

  if (data.allDays === 0) {
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
        <PageHeader
          title="Behavior Log"
          subtitle={
            s.firstDate && s.lastDate
              ? `${weekdayDate(s.firstDate)} – ${weekdayDate(s.lastDate)} · ${s.days} school ${s.days === 1 ? "day" : "days"}`
              : "Nothing in this slice"
          }
        />

        <FilterBar
          filters={filters}
          days={s.days}
          allDays={data.allDays}
          incidents={s.total}
          allIncidents={data.allIncidents}
        >
          {s.days === 0 ? (
            <p className="card p-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              No school days match these filters. Widen the date range or clear a filter.
            </p>
          ) : (
            <>
              {/* Hero figure — the one number this whole thing exists to establish. */}
              <section className="card mb-4 p-5">
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {activeCount(filters) > 0 ? "Incidents in this slice" : "Recorded incidents"}
                </p>
                <p className="mt-1 text-5xl font-semibold leading-none">{s.total}</p>
                <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                  {s.perDay} per school day across {s.days} {s.days === 1 ? "day" : "days"}
                </p>
              </section>

              {/* An unchecked number and a checked one look identical on a chart.
                  Say which is which, and link straight to the days that need it. */}
              {unverified.length > 0 && (
                <section
                  className="card mb-4 p-4"
                  style={{ borderColor: "var(--warning)", borderWidth: 2 }}
                >
                  <p className="text-sm font-semibold">
                    {unverified.length === 1
                      ? "One day here has never been checked against the paper"
                      : `${unverified.length} of these ${s.days} days have never been checked against the paper`}
                  </p>
                  <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                    Their numbers are transcriptions. Open a day to see the marks they were
                    counted from, photograph the page if you still have it, and correct anything
                    that&apos;s off.
                  </p>
                  <p className="mt-2 flex flex-wrap gap-2">
                    {unverified.map((d) => (
                      <Link
                        key={d.log_date}
                        href={query ? `/day/${d.log_date}?${query}` : `/day/${d.log_date}`}
                        className="rounded-full border px-3 py-1 text-xs"
                        style={{ borderColor: "var(--border)" }}
                      >
                        {weekdayDate(d.log_date)} · {d.total}
                      </Link>
                    ))}
                  </p>
                </section>
              )}

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
                {/* Not behaviors, so these two are never narrowed by the behavior
                    filter — see Dataset.support. */}
                <StatTile
                  label="Assistance called"
                  value={data.support.assistance}
                  note={`${perDayOf(data.support.assistance, s.days)} per school day`}
                />
                <StatTile
                  label="Removed from class"
                  value={data.support.removed}
                  note={`${perDayOf(data.support.removed, s.days)} per school day`}
                />
              </section>

              {/* Counted once per day, from the box at the top of the form. Kept out of
                  the incident figures above: these record what the school did in
                  response, so counting them as incidents would report events twice. */}
              {(data.support.assistance > 0 || data.support.removed > 0) && (
                <section className="card mb-4 p-4">
                  <h2 className="text-sm font-semibold">What the school had to do</h2>
                  <p className="mb-2 text-xs" style={{ color: "var(--text-muted)" }}>
                    Counted once per day, not per class
                    {activeCount(filters) > 0 ? ", so a class-period filter doesn't narrow these" : ""}
                    . Not included in the incident totals above.
                  </p>

                  {/* Its own plot, not a second line on the incidents chart: these
                      run in single figures where incidents run to dozens, and one
                      chart never carries two y-scales. */}
                  <SupportPerDayChart
                    data={data.dailyTotals}
                    dayHref={(date) => (query ? `/day/${date}?${query}` : `/day/${date}`)}
                  />
                  <div className="mb-3 mt-1 border-t pt-3" style={{ borderColor: "var(--border)" }}>
                    <SupportLegend />
                  </div>

                  {unconfirmedSupport > 0 && (
                    <p className="mb-2 text-xs" style={{ color: "var(--warning)" }}>
                      {unconfirmedSupport === 1
                        ? "One of these days hasn't had its two numbers confirmed yet."
                        : `${unconfirmedSupport} of these days haven't had their two numbers confirmed yet.`}{" "}
                      Open the day and tick the box once you&apos;ve checked them.
                    </p>
                  )}

                  <table className="w-full border-collapse text-sm">
                    <caption className="pb-1 text-left text-xs" style={{ color: "var(--text-muted)" }}>
                      The same figures as numbers, for the days it happened on.
                    </caption>
                    <thead>
                      <tr style={{ color: "var(--text-muted)" }}>
                        <th scope="col" className="py-1 text-left text-xs font-medium">
                          Day
                        </th>
                        {SUPPORT_EVENTS.map((e) => (
                          <th
                            key={e.key}
                            scope="col"
                            className="py-1 text-right text-xs font-medium"
                            title={e.hint}
                          >
                            {e.short}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {supportDays.map((d) => (
                        <tr
                          key={d.log_date}
                          className="border-t"
                          style={{ borderColor: "var(--border)" }}
                        >
                          <th scope="row" className="py-1.5 text-left text-xs font-normal">
                            <Link
                              href={query ? `/day/${d.log_date}?${query}` : `/day/${d.log_date}`}
                              className="underline underline-offset-2"
                            >
                              {weekdayDate(d.log_date)}
                            </Link>
                          </th>
                          <td className="tnum py-1.5 text-right">{d.assistance || "·"}</td>
                          <td className="tnum py-1.5 text-right">{d.removed || "·"}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t" style={{ borderColor: "var(--border)" }}>
                        <th scope="row" className="py-1.5 text-left text-xs font-medium">
                          Across {s.days} recorded {s.days === 1 ? "day" : "days"}
                        </th>
                        <td className="tnum py-1.5 text-right font-semibold">
                          {data.support.assistance}
                        </td>
                        <td className="tnum py-1.5 text-right font-semibold">
                          {data.support.removed}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </section>
              )}

              <section className="card mb-4 p-4">
                <h2 className="text-sm font-semibold">Total incidents per day</h2>
                <p className="mb-2 text-xs" style={{ color: "var(--text-muted)" }}>
                  {data.behaviors.length === BEHAVIORS.length
                    ? "Every behavior type combined."
                    : `Only the ${data.behaviors.length} selected behavior ${data.behaviors.length === 1 ? "type" : "types"}.`}
                </p>
                <TotalPerDayChart
                  data={data.dailyTotals}
                  dayHref={(date) => (query ? `/day/${date}?${query}` : `/day/${date}`)}
                />
              </section>

              {data.behaviors.length > 1 && (
                <section className="card mb-4 p-4">
                  <h2 className="text-sm font-semibold">What made up each day</h2>
                  <p className="mb-2 text-xs" style={{ color: "var(--text-muted)" }}>
                    The same daily totals, split by behavior type.
                  </p>
                  <StackedByBehaviorChart
                    totals={data.dailyTotals}
                    behaviorDaily={data.behaviorDaily}
                    behaviors={data.behaviors}
                  />
                  <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--border)" }}>
                    <BehaviorLegend behaviors={data.behaviors} />
                  </div>
                </section>
              )}

              <section className="card mb-4 p-4">
                <h2 className="text-sm font-semibold">Which class period is hardest</h2>
                <p className="mb-3 text-xs" style={{ color: "var(--text-muted)" }}>
                  Every incident in this slice, by class and behavior number. Darker means more.
                </p>
                <PeriodHeatmap
                  periodTotals={data.periodTotals}
                  periodBehavior={data.periodBehavior}
                  behaviors={data.behaviors}
                />
              </section>

              <section className="mb-4">
                <h2 className="mb-1 px-1 text-sm font-semibold">Each behavior over time</h2>
                <p className="mb-3 px-1 text-xs" style={{ color: "var(--text-muted)" }}>
                  Same scale within each chart, not across them.
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {data.behaviors.map((b) => {
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
                . Filters carry across all three.
              </p>
            </>
          )}
        </FilterBar>
      </main>
      <Nav query={query} />
    </>
  );
}
