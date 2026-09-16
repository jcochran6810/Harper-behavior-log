import FilterBar from "@/components/FilterBar";
import LogTable from "@/components/LogTable";
import Nav from "@/components/Nav";
import PageHeader from "@/components/PageHeader";
import { buildDataset } from "@/lib/derive";
import { parseFilters, serializeFilters, type SearchParams } from "@/lib/filters";
import { getLogs } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function DataPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filters = parseFilters(await searchParams);
  const data = buildDataset(await getLogs(), filters);

  const incidents = data.dailyTotals.reduce((sum, d) => sum + d.total, 0);
  const query = serializeFilters(filters);

  return (
    <>
      <main className="mx-auto max-w-3xl px-4 pb-8 pt-6">
        <PageHeader
          title="All logs"
          subtitle={`${data.logs.length} ${data.logs.length === 1 ? "day" : "days"} shown`}
          action={
            <a
              href={query ? `/api/export?${query}` : "/api/export"}
              className="text-sm underline"
              style={{ color: "var(--text-secondary)" }}
            >
              CSV
            </a>
          }
        />

        <FilterBar
          filters={filters}
          days={data.logs.length}
          allDays={data.allDays}
          incidents={incidents}
          allIncidents={data.allIncidents}
        >
          {data.logs.length === 0 ? (
            <p className="card p-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              {data.allDays === 0
                ? "Nothing saved yet."
                : "No school days match these filters. Widen the date range or clear a filter."}
            </p>
          ) : (
            <LogTable logs={data.logs} behaviors={data.behaviors} query={query} />
          )}
        </FilterBar>
      </main>
      <Nav query={query} />
    </>
  );
}
