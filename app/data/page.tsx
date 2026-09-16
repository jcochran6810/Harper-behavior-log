import LogTable from "@/components/LogTable";
import Nav from "@/components/Nav";
import { getLogs } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function DataPage() {
  const logs = await getLogs();

  return (
    <>
      <main className="mx-auto max-w-3xl px-4 pb-8 pt-6">
        <div className="mb-5 flex items-baseline justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">All logs</h1>
            <p className="mt-0.5 text-sm" style={{ color: "var(--text-muted)" }}>
              {logs.length} {logs.length === 1 ? "day" : "days"} recorded
            </p>
          </div>
          <a href="/api/export" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
            Download CSV
          </a>
        </div>

        {logs.length === 0 ? (
          <p className="card p-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
            Nothing saved yet.
          </p>
        ) : (
          <LogTable logs={logs} />
        )}
      </main>
      <Nav />
    </>
  );
}
