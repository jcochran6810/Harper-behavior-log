import Link from "next/link";
import FilterBar from "@/components/FilterBar";
import Nav from "@/components/Nav";
import PageHeader from "@/components/PageHeader";
import { weekdayDate } from "@/components/charts";
import { buildDataset } from "@/lib/derive";
import { parseFilters, serializeFilters, type SearchParams } from "@/lib/filters";
import { signPhotos } from "@/lib/photos";
import { getLogs } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function PhotosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filters = parseFilters(await searchParams);
  const data = buildDataset(await getLogs(), filters);
  const query = serializeFilters(filters);

  const withPhotos = data.logs.filter((log) => log.image_path);
  const urls = await signPhotos(withPhotos.map((log) => log.image_path as string));
  const incidents = data.dailyTotals.reduce((sum, d) => sum + d.total, 0);
  const missing = data.logs.length - withPhotos.length;

  return (
    <>
      <main className="mx-auto max-w-3xl px-4 pb-8 pt-6">
        <PageHeader
          title="Original pages"
          subtitle={`${withPhotos.length} photographed ${withPhotos.length === 1 ? "log" : "logs"}`}
        />

        <FilterBar
          filters={filters}
          days={data.logs.length}
          allDays={data.allDays}
          incidents={incidents}
          allIncidents={data.allIncidents}
        >
          {withPhotos.length === 0 ? (
            <div className="card p-6 text-center">
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {data.allDays === 0
                  ? "No logs saved yet."
                  : "None of the logs in this slice have a photo attached."}
              </p>
              <p className="mx-auto mt-2 max-w-sm text-xs" style={{ color: "var(--text-muted)" }}>
                Photos are saved automatically whenever a log is added by picture. Days entered
                by hand, and the five September logs that were transcribed before the site
                existed, have no image.
              </p>
              <Link href="/upload" className="mt-4 inline-block text-sm underline">
                Add a log by photo
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {withPhotos.map((log) => {
                  const url = urls.get(log.image_path as string);
                  const total = log.harper_log_periods.reduce((sum, p) => sum + p.total, 0);
                  return (
                    <Link
                      key={log.id}
                      href={query ? `/day/${log.log_date}?${query}` : `/day/${log.log_date}`}
                      className="card overflow-hidden"
                    >
                      {url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={url}
                          alt={`Behavior log for ${weekdayDate(log.log_date)}`}
                          loading="lazy"
                          className="aspect-[3/4] w-full object-cover"
                          style={{ background: "var(--page)" }}
                        />
                      ) : (
                        <div
                          className="grid aspect-[3/4] w-full place-items-center text-xs"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Couldn&apos;t load
                        </div>
                      )}
                      <div className="px-2.5 py-2">
                        <p className="text-xs font-medium">{weekdayDate(log.log_date)}</p>
                        <p className="tnum text-xs" style={{ color: "var(--text-muted)" }}>
                          {total} incidents
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {missing > 0 && (
                <div className="mt-5">
                  <p className="mb-2 text-xs" style={{ color: "var(--text-muted)" }}>
                    {missing} {missing === 1 ? "day has" : "days have"} no photo — entered by hand,
                    or transcribed before the site existed. Their numbers can&apos;t be checked
                    against anything. Open one to photograph the paper now:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {data.logs
                      .filter((log) => !log.image_path)
                      .map((log) => (
                        <Link
                          key={log.id}
                          href={query ? `/day/${log.log_date}?${query}` : `/day/${log.log_date}`}
                          className="card px-3 py-1.5 text-xs"
                        >
                          {weekdayDate(log.log_date)} →
                        </Link>
                      ))}
                  </div>
                </div>
              )}
              <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                Tap any page to open that day — the photo full size, next to the numbers taken
                off it. Image links expire after a few minutes, so they can&apos;t be forwarded.
              </p>
            </>
          )}
        </FilterBar>
      </main>
      <Nav query={query} />
    </>
  );
}
