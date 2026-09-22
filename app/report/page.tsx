import FilterBar from "@/components/FilterBar";
import Nav from "@/components/Nav";
import PrintButton from "@/components/PrintButton";
import ReportOptions from "@/components/ReportOptions";
import { PeriodHeatmap, TotalPerDayChart, weekdayDate } from "@/components/charts";
import { PERIOD_KEYS, periodLabel } from "@/lib/behaviors";
import { buildDataset } from "@/lib/derive";
import { describeFilters, parseFilters, serializeFilters, type SearchParams } from "@/lib/filters";
import { signPhotos } from "@/lib/photos";
import { getLogs } from "@/lib/queries";
import { parseSections } from "@/lib/report";
import { pct, summarize } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const sections = parseSections(params);
  const data = buildDataset(await getLogs(), filters);
  const s = summarize(data.dailyTotals, data.behaviorDaily, data.periodTotals, data.behaviors);
  const scope = describeFilters(filters);

  const observedPeriods = data.periodTotals.filter((p) => p.days_recorded > 0);
  // How much of this slice a human has actually held up against the paper.
  const verifiedDays = data.dailyTotals.filter((d) => d.verified).length;
  const unverifiedDays = data.dailyTotals.length - verifiedDays;
  const photoLogs = data.logs.filter((log) => log.image_path);
  const photoUrls = sections.includes("photos")
    ? await signPhotos(photoLogs.map((log) => log.image_path as string), 1800)
    : new Map<string, string>();

  const printedOn = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (data.allDays === 0) {
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
        <div className="no-print mb-3 flex items-center justify-between gap-3">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Print this, or save it as a PDF, to bring to the meeting.
          </p>
          <PrintButton />
        </div>

        <FilterBar
          filters={filters}
          days={s.days}
          allDays={data.allDays}
          incidents={s.total}
          allIncidents={data.allIncidents}
        >
          <ReportOptions filters={filters} sections={sections} photoCount={photoLogs.length} />

          {s.days === 0 ? (
            <p className="card p-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              No school days match these filters, so there&apos;s nothing to report yet.
            </p>
          ) : (
            <>
              <header className="mb-6">
                <h1 className="text-2xl font-semibold">Classroom Behavior Summary</h1>
                <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                  {s.firstDate && s.lastDate
                    ? `Observation period: ${weekdayDate(s.firstDate)} through ${weekdayDate(s.lastDate)} · ${s.days} school ${s.days === 1 ? "day" : "days"}`
                    : null}
                </p>
                {/* A filtered report must say so on the page, not just on screen. */}
                {scope && (
                  <p className="mt-1 text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    Filtered view: {scope}. Counts below cover only this slice, not the full
                    record.
                  </p>
                )}
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Compiled {printedOn} from the daily behavior logs sent home by the classroom
                  teacher.
                </p>
              </header>

              {sections.includes("summary") && (
                <section className="card mb-5 p-5">
                  <h2 className="mb-3 text-base font-semibold">What the logs show</h2>
                  <ul className="space-y-2 text-sm leading-relaxed">
                    <li>
                      <strong className="tnum">{s.total} documented incidents</strong> across{" "}
                      {s.days} school {s.days === 1 ? "day" : "days"} — an average of{" "}
                      <strong className="tnum">{s.perDay} per day</strong>.
                    </li>
                    {s.worstDay && (
                      <li>
                        The hardest single day was {weekdayDate(s.worstDay.log_date)} with{" "}
                        <strong className="tnum">{s.worstDay.total} incidents</strong> recorded
                        across {s.worstDay.periods_with_incidents} class{" "}
                        {s.worstDay.periods_with_incidents === 1 ? "period" : "periods"}.
                      </li>
                    )}
                    {s.topPeriods[0] && (
                      <li>
                        Incidents concentrate in a small number of class periods:{" "}
                        <strong>{pct(s.concentration)}</strong> of everything recorded happened
                        during{" "}
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
                        {pct(s.topBehaviors[0].share + s.topBehaviors[1].share)} of all
                        incidents.
                      </li>
                    )}
                    <li style={{ color: "var(--text-secondary)" }}>
                      Counts come from the tally marks the classroom teacher recorded on the
                      daily log form, transcribed one row at a time.{" "}
                      {/* Never claim more than is true: a summary that says every number was
                          checked when some were not is worth less in a meeting than one that
                          says plainly which is which. */}
                      {unverifiedDays === 0
                        ? `All ${s.days} ${s.days === 1 ? "day" : "days"} here have been checked against the original page by a parent.`
                        : verifiedDays === 0
                          ? `${s.days === 1 ? "This day has" : `None of these ${s.days} days has`} yet been checked against the original page, so ${s.days === 1 ? "its" : "these"} numbers should be read as a transcription rather than a confirmed count.`
                          : `${verifiedDays} of these ${s.days} days have been checked against the original page by a parent; the other ${unverifiedDays} ${unverifiedDays === 1 ? "is a transcription that has" : "are transcriptions that have"} not yet been checked.`}
                    </li>
                  </ul>
                </section>
              )}

              {sections.includes("chart") && (
                <section className="card mb-5 p-4">
                  <h2 className="mb-1 text-base font-semibold">Incidents per school day</h2>
                  <p className="mb-2 text-xs" style={{ color: "var(--text-muted)" }}>
                    Total incidents up the side, each school day along the bottom. The number
                    under each date is that day&apos;s total.
                  </p>
                  <TotalPerDayChart data={data.dailyTotals} />
                </section>
              )}

              {sections.includes("behaviors") && (
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
                        <tr
                          key={b.code}
                          className="border-t"
                          style={{ borderColor: "var(--border)" }}
                        >
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
                          <td
                            className="tnum py-2 text-right"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {pct(b.share)}
                          </td>
                          <td
                            className="tnum py-2 text-right"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {(b.total / s.days).toFixed(1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}

              {sections.includes("periods") && (
                <section className="card mb-5 p-4">
                  <h2 className="mb-1 text-base font-semibold">By class period</h2>
                  <p className="mb-3 text-xs" style={{ color: "var(--text-muted)" }}>
                    Columns are the numbered behaviors from the log form. This is where support
                    staffing would have the most effect.
                  </p>
                  <PeriodHeatmap
                    periodTotals={observedPeriods}
                    periodBehavior={data.periodBehavior}
                    behaviors={data.behaviors}
                  />
                </section>
              )}

              {sections.includes("daily") && (
                <section className="print-break mb-5">
                  <h2 className="mb-3 text-base font-semibold">
                    Daily record with teacher&apos;s notes
                  </h2>
                  <div className="space-y-3">
                    {data.logs.map((log) => {
                      const periods = [...log.harper_log_periods].sort(
                        (a, b) =>
                          PERIOD_KEYS.indexOf(a.period_key) - PERIOD_KEYS.indexOf(b.period_key),
                      );
                      const total = periods.reduce((sum, p) => sum + p.total, 0);
                      return (
                        <article key={log.id} className="card p-4">
                          <div className="mb-2 flex items-baseline justify-between gap-3">
                            <h3 className="font-semibold">{weekdayDate(log.log_date)}</h3>
                            <span
                              className="tnum text-sm"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              {total} incidents
                            </span>
                          </div>
                          {!log.verified_at && (
                            <p className="mb-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                              Transcribed from the paper log; not yet checked against the original
                              page.
                            </p>
                          )}
                          <table className="w-full border-collapse text-sm">
                            <tbody>
                              {periods.map((p) => {
                                const active = data.behaviors.filter(
                                  (b) => p[`b${b.code}` as "b1"] > 0,
                                );
                                if (!p.notes && active.length === 0 && !p.not_observed) {
                                  return null;
                                }
                                return (
                                  <tr
                                    key={p.id}
                                    className="border-t align-top"
                                    style={{ borderColor: "var(--border)" }}
                                  >
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
              )}

              {sections.includes("photos") && photoLogs.length > 0 && (
                <section className="print-break">
                  <h2 className="mb-1 text-base font-semibold">
                    Appendix: the original log pages
                  </h2>
                  <p className="mb-3 text-xs" style={{ color: "var(--text-muted)" }}>
                    {photoLogs.length} of {data.logs.length} days in this view were added by
                    photograph. These are the pages the counts were read from.
                  </p>
                  <div className="space-y-3">
                    {photoLogs.map((log) => {
                      const url = photoUrls.get(log.image_path as string);
                      return (
                        <figure key={log.id} className="card overflow-hidden p-3">
                          <figcaption className="mb-2 text-sm font-semibold">
                            {weekdayDate(log.log_date)}
                          </figcaption>
                          {url ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={url}
                              alt={`Behavior log page for ${weekdayDate(log.log_date)}`}
                              className="w-full"
                              style={{ maxHeight: "85vh", objectFit: "contain" }}
                            />
                          ) : (
                            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                              Couldn&apos;t load this image.
                            </p>
                          )}
                        </figure>
                      );
                    })}
                  </div>
                </section>
              )}
            </>
          )}
        </FilterBar>
      </main>
      <Nav query={serializeFilters(filters)} />
    </>
  );
}
