import { notFound } from "next/navigation";
import DayDetail from "@/components/DayDetail";
import Nav from "@/components/Nav";
import PageHeader from "@/components/PageHeader";
import { serializeFilters, parseFilters, type SearchParams } from "@/lib/filters";
import { signPhotos } from "@/lib/photos";
import { getLogByDateFull } from "@/lib/queries";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function longDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function DayPage({
  params,
  searchParams,
}: {
  params: Promise<{ date: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { date } = await params;
  if (!DATE_RE.test(date)) notFound();

  const log = await getLogByDateFull(date);
  if (!log) notFound();

  // Signed here on the server: the bucket stays private and the URL expires.
  const photoUrl = log.image_path
    ? (await signPhotos([log.image_path], 900)).get(log.image_path) ?? null
    : null;

  const query = serializeFilters(parseFilters(await searchParams));

  return (
    <>
      <main className="mx-auto max-w-3xl px-4 pb-8 pt-6">
        <PageHeader
          title={longDate(log.log_date)}
          subtitle={log.date_confirmed ? undefined : "The date box was blank on this form"}
          action={
            <a
              href={query ? `/data?${query}` : "/data"}
              className="text-sm underline"
              style={{ color: "var(--text-secondary)" }}
            >
              ← All logs
            </a>
          }
        />
        <DayDetail log={log} photoUrl={photoUrl} />
      </main>
      <Nav query={query} />
    </>
  );
}
