"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
}: {
  logs: LogWithPeriods[];
  behaviors?: Behavior[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(logs[0]?.id ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const dayTotals = (log: LogWithPeriods) =>
    behaviors.map((b) =>
      log.harper_log_periods.reduce((sum, p) => sum + p[`b${b.code}` as (typeof KEYS)[number]], 0),
    );

  async function remove(id: string) {
    setBusy(id);
    await fetch(`/api/logs/${id}`, { method: "DELETE" });
    setBusy(null);
    setConfirming(null);
    router.refresh();
  }

  async function fixDate(id: string, value: string) {
    setBusy(id);
    const res = await fetch(`/api/logs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ log_date: value }),
    });
    setBusy(null);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      alert(body.error ?? "Couldn't change that date.");
      return;
    }
    router.refresh();
  }

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
                    {weekday(log.log_date)}
                    {!log.date_confirmed && (
                      <span className="ml-1.5 text-xs" style={{ color: "var(--warning)" }} title="Date was blank on the form">
                        ⚠
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
        <h2 className="mb-2 px-1 text-sm font-semibold">Day by day, with the teacher&apos;s notes</h2>
        <div className="space-y-2">
          {logs.map((log) => {
            const expanded = open === log.id;
            const periods = [...log.harper_log_periods].sort(
              (a, b) => PERIOD_KEYS.indexOf(a.period_key) - PERIOD_KEYS.indexOf(b.period_key),
            );
            const total = periods.reduce((sum, p) => sum + p.total, 0);
            return (
              <article key={log.id} className="card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : log.id)}
                  aria-expanded={expanded}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <span className="font-medium">{weekday(log.log_date)}</span>
                  <span className="flex items-center gap-3">
                    <span className="tnum text-sm" style={{ color: "var(--text-muted)" }}>
                      {total} incidents
                    </span>
                    <span aria-hidden style={{ color: "var(--text-muted)" }}>
                      {expanded ? "▾" : "▸"}
                    </span>
                  </span>
                </button>

                {expanded && (
                  <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: "var(--border)" }}>
                    {!log.date_confirmed && (
                      <div
                        className="mb-3 rounded-lg p-3 text-xs"
                        style={{ background: "var(--page)" }}
                      >
                        <p className="mb-2">The date box was blank on this form. Set the right date:</p>
                        <input
                          type="date"
                          defaultValue={log.log_date}
                          onChange={(e) => e.target.value && void fixDate(log.id, e.target.value)}
                          disabled={busy === log.id}
                          className="rounded-lg border px-3 py-2"
                          style={{ borderColor: "var(--border)", background: "transparent", color: "var(--text-primary)" }}
                        />
                      </div>
                    )}

                    {log.overall_note && (
                      <p className="mb-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                        {log.overall_note}
                      </p>
                    )}

                    <ul className="space-y-2">
                      {periods.map((p) => {
                        const active = behaviors.filter((b) => p[`b${b.code}` as (typeof KEYS)[number]] > 0);
                        if (!p.notes && active.length === 0 && !p.not_observed) return null;
                        return (
                          <li key={p.id} className="border-t pt-2 text-sm" style={{ borderColor: "var(--border)" }}>
                            <p className="font-medium">
                              {periodLabel(p.period_key)}
                              {p.specials_subject && (
                                <span className="font-normal" style={{ color: "var(--text-muted)" }}>
                                  {" "}— {p.specials_subject}
                                </span>
                              )}
                            </p>
                            {active.length > 0 && (
                              <p className="mt-1 flex flex-wrap gap-1.5">
                                {active.map((b) => (
                                  <span
                                    key={b.code}
                                    className="tnum rounded px-1.5 py-0.5 text-xs"
                                    style={{ background: `${b.color}1f`, color: "var(--text-primary)" }}
                                    title={b.label}
                                  >
                                    {b.short} ×{p[`b${b.code}` as (typeof KEYS)[number]]}
                                  </span>
                                ))}
                              </p>
                            )}
                            {p.notes && (
                              <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                                {p.notes}
                              </p>
                            )}
                            {p.not_observed && !p.notes && (
                              <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                                Not observed.
                              </p>
                            )}
                          </li>
                        );
                      })}
                    </ul>

                    <div className="mt-4 flex items-center gap-4 text-xs">
                      {log.image_path && (
                        <a
                          href={`/api/photo/${log.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          View the original photo
                        </a>
                      )}
                      {confirming === log.id ? (
                        <span className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => void remove(log.id)}
                            disabled={busy === log.id}
                            className="underline"
                            style={{ color: "var(--critical)" }}
                          >
                            {busy === log.id ? "Deleting…" : "Yes, delete this day"}
                          </button>
                          <button type="button" onClick={() => setConfirming(null)} className="underline">
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirming(log.id)}
                          className="underline"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Delete this day
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
