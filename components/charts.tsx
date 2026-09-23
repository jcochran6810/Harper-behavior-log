import {
  BEHAVIORS,
  SUPPORT_EVENTS,
  rampColor,
  rampInk,
  supportColor,
  type Behavior,
} from "@/lib/behaviors";
import type { BehaviorDaily, DailyTotal, PeriodBehavior, PeriodTotal } from "@/lib/types";

export function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

export function weekdayDate(iso: string): string {
  const date = new Date(`${iso}T12:00:00Z`);
  const day = date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  return `${day} ${shortDate(iso)}`;
}

/** Round an axis maximum up to a clean number. */
function niceMax(value: number): number {
  if (value <= 5) return 5;
  const step = value > 100 ? 20 : value > 40 ? 10 : 5;
  return Math.ceil(value / step) * step;
}

function ticks(max: number, count = 4): number[] {
  const step = max / count;
  return Array.from({ length: count + 1 }, (_, i) => Math.round(i * step));
}

const GRID = "var(--grid)";
const AXIS = "var(--axis)";
const MUTED = "var(--text-muted)";
const INK = "var(--text-primary)";
const SURFACE = "var(--surface-1)";

/**
 * Show every Nth date when the day columns get too narrow to hold a label.
 *
 * A school year is ~180 columns in a 760-wide plot, so printing "10/22" under
 * every one turns the axis into a smear. The stride is anchored to the LAST day
 * rather than the first, because the most recent day is the one a reader looks
 * for, and it is the one that must always be labelled.
 */
function labelStride(band: number, minWidth = 46): number {
  return Math.max(1, Math.ceil(minWidth / band));
}

function labelled(index: number, count: number, stride: number): boolean {
  return (count - 1 - index) % stride === 0;
}

/* ------------------------------------------------------------ total per day */

export function TotalPerDayChart({
  data,
  /** When set, each bar links to that day's page. Left off for the printed report. */
  dayHref,
}: {
  data: DailyTotal[];
  dayHref?: (isoDate: string) => string;
}) {
  const W = 760, H = 320;
  // Bottom band holds three stacked rows: date, weekday, and the day's total.
  const M = { top: 20, right: 16, bottom: 64, left: 44 };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;

  if (data.length === 0) return <EmptyPlot label="No logs yet" />;

  const max = niceMax(Math.max(...data.map((d) => d.total), 1));
  const band = plotW / data.length;
  const barW = Math.min(24, band * 0.55);
  const baseline = M.top + plotH;
  const stride = labelStride(band);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
      aria-label={`Total incidents per day, ${data.length} days recorded`}>
      {ticks(max).map((t) => {
        const y = baseline - (t / max) * plotH;
        return (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={y} y2={y} stroke={t === 0 ? AXIS : GRID} strokeWidth={1} />
            <text x={M.left - 8} y={y + 4} textAnchor="end" fontSize={12} fill={MUTED} className="tnum">
              {t}
            </text>
          </g>
        );
      })}

      {data.map((d, i) => {
        const h = (d.total / max) * plotH;
        const x = M.left + i * band + (band - barW) / 2;
        const cx = x + barW / 2;
        const body = (
          <>
            <title>
              {dayHref
                ? `${weekdayDate(d.log_date)}: ${d.total} incidents — open this day`
                : `${weekdayDate(d.log_date)}: ${d.total} incidents`}
            </title>
            {/* A full-height hit area, so the whole column is tappable on a phone
                rather than just the bar itself. */}
            {dayHref && (
              <rect
                x={M.left + i * band}
                y={M.top}
                width={band}
                height={plotH + M.bottom - 12}
                fill="transparent"
              />
            )}
            <rect x={x} y={baseline - h} width={barW} height={Math.max(h, 0)} rx={4} fill={BEHAVIORS[0].color} />
            {h > 4 && <rect x={x} y={baseline - 4} width={barW} height={4} fill={BEHAVIORS[0].color} />}
            {labelled(i, data.length, stride) && (
              <>
                <text x={cx} y={baseline + 20} textAnchor="middle" fontSize={12} fill={MUTED}>
                  {shortDate(d.log_date)}
                </text>
                <text x={cx} y={baseline + 34} textAnchor="middle" fontSize={11} fill={MUTED}>
                  {d.day_of_week ?? ""}
                </text>
                {/* The day's total, printed under its date. */}
                <text x={cx} y={baseline + 52} textAnchor="middle" fontSize={13} fontWeight={600} fill={INK} className="tnum">
                  {d.total}
                </text>
              </>
            )}
          </>
        );
        return dayHref ? (
          <a key={d.log_date} href={dayHref(d.log_date)} className="cursor-pointer">
            {body}
          </a>
        ) : (
          <g key={d.log_date}>{body}</g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------- stacked breakdown per day */

export function StackedByBehaviorChart({
  totals,
  behaviorDaily,
  behaviors = BEHAVIORS,
}: {
  totals: DailyTotal[];
  behaviorDaily: BehaviorDaily[];
  behaviors?: Behavior[];
}) {
  const W = 760, H = 300;
  const M = { top: 20, right: 16, bottom: 44, left: 44 };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;

  if (totals.length === 0) return <EmptyPlot label="No logs yet" />;

  const byDate = new Map<string, Map<number, number>>();
  for (const row of behaviorDaily) {
    if (!byDate.has(row.log_date)) byDate.set(row.log_date, new Map());
    byDate.get(row.log_date)!.set(row.code, row.count);
  }

  const max = niceMax(Math.max(...totals.map((d) => d.total), 1));
  const band = plotW / totals.length;
  const barW = Math.min(24, band * 0.55);
  const stride = labelStride(band);
  const GAP = 2; // surface gap between stacked segments

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
      aria-label="Incidents per day, broken down by behavior type">
      {ticks(max).map((t) => {
        const y = M.top + plotH - (t / max) * plotH;
        return (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={y} y2={y} stroke={t === 0 ? AXIS : GRID} strokeWidth={1} />
            <text x={M.left - 8} y={y + 4} textAnchor="end" fontSize={12} fill={MUTED} className="tnum">
              {t}
            </text>
          </g>
        );
      })}

      {totals.map((day, i) => {
        const counts = byDate.get(day.log_date) ?? new Map();
        const x = M.left + i * band + (band - barW) / 2;
        let cursor = M.top + plotH;
        return (
          <g key={day.log_date}>
            {behaviors.map((b) => {
              const value = counts.get(b.code) ?? 0;
              if (value <= 0) return null;
              const h = (value / max) * plotH;
              cursor -= h;
              const y = cursor;
              return (
                <rect
                  key={b.code}
                  x={x}
                  y={y}
                  width={barW}
                  height={Math.max(h - GAP, 1)}
                  rx={2}
                  fill={b.color}
                >
                  <title>{`${weekdayDate(day.log_date)} — ${b.short}: ${value}`}</title>
                </rect>
              );
            })}
            {labelled(i, totals.length, stride) && (
              <text x={x + barW / 2} y={M.top + plotH + 20} textAnchor="middle" fontSize={12} fill={MUTED}>
                {shortDate(day.log_date)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------- assistance called & removals, per day */

/**
 * Integer ticks for a small-count axis.
 *
 * `ticks()` divides the range into four and rounds, which is right for incident
 * counts in the dozens and wrong here: a maximum of 3 would print 0, 1, 2, 3 as
 * "0, 1, 2, 3" only by luck and a maximum of 5 prints "0, 1, 3, 4, 5". These are
 * whole events, so every gridline is a whole number.
 */
function countTicks(max: number): number[] {
  if (max <= 6) return Array.from({ length: max + 1 }, (_, i) => i);
  return ticks(niceMax(max));
}

/**
 * Two series — assistance called, removed from class — as grouped bars over the
 * school days.
 *
 * Its own plot rather than a second line on the incidents chart, because that
 * would mean two y-scales on one chart: these run 0-3 where incidents run to
 * seventy, so a shared axis flattens them to nothing and a twin axis invites the
 * reader to compare two unrelated units. Same width and side margins as
 * TotalPerDayChart, so the day columns line up down the page.
 *
 * Identity never rests on colour alone: a legend sits beside it, every non-zero
 * bar carries its own number, and the two series keep a fixed left/right position
 * within each day.
 */
export function SupportPerDayChart({
  data,
  dayHref,
}: {
  data: DailyTotal[];
  dayHref?: (isoDate: string) => string;
}) {
  const W = 760, H = 260;
  const M = { top: 20, right: 16, bottom: 52, left: 44 };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;

  if (data.length === 0) return <EmptyPlot label="No logs yet" />;

  const series = [
    { event: SUPPORT_EVENTS[0], valueOf: (d: DailyTotal) => d.assistance },
    { event: SUPPORT_EVENTS[1], valueOf: (d: DailyTotal) => d.removed },
  ];

  const max = Math.max(
    ...data.flatMap((d) => series.map((s) => s.valueOf(d))),
    1,
  );
  const axisMax = Math.max(...countTicks(max));
  const band = plotW / data.length;
  const GAP = 2; // surface gap between the two bars of a day
  const barW = Math.min(18, (band * 0.62 - GAP) / 2);
  const groupW = barW * 2 + GAP;
  const baseline = M.top + plotH;
  const stride = labelStride(band);
  // Below this the two numbers in a day would touch. Identity still has two
  // channels without them: the legend, and each series' fixed side of the pair.
  const showValues = band >= 24;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
      aria-label={`Assistance called and removals from class per day, ${data.length} days recorded`}>
      {countTicks(max).map((t) => {
        const y = baseline - (t / axisMax) * plotH;
        return (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={y} y2={y} stroke={t === 0 ? AXIS : GRID} strokeWidth={1} />
            <text x={M.left - 8} y={y + 4} textAnchor="end" fontSize={12} fill={MUTED} className="tnum">
              {t}
            </text>
          </g>
        );
      })}

      {data.map((d, i) => {
        const groupX = M.left + i * band + (band - groupW) / 2;
        const body = (
          <>
            <title>
              {`${weekdayDate(d.log_date)}: assistance called ${d.assistance}×, removed from class ${d.removed}×`}
            </title>
            {dayHref && (
              <rect
                x={M.left + i * band}
                y={M.top}
                width={band}
                height={plotH + M.bottom - 12}
                fill="transparent"
              />
            )}
            {series.map((s, si) => {
              const value = s.valueOf(d);
              const h = (value / axisMax) * plotH;
              const x = groupX + si * (barW + GAP);
              return (
                <g key={s.event.key}>
                  {value > 0 && (
                    <>
                      <rect
                        x={x}
                        y={baseline - h}
                        width={barW}
                        height={h}
                        rx={4}
                        fill={supportColor(s.event)}
                      />
                      {/* Square off the data-end so the bar sits on the baseline. */}
                      {h > 4 && (
                        <rect x={x} y={baseline - 4} width={barW} height={4} fill={supportColor(s.event)} />
                      )}
                      {/* The number on the bar: the secondary encoding that keeps
                          the two series legible without relying on hue. */}
                      {showValues && (
                        <text
                          x={x + barW / 2}
                          y={baseline - h - 6}
                          textAnchor="middle"
                          fontSize={12}
                          fontWeight={600}
                          fill={INK}
                          className="tnum"
                        >
                          {value}
                        </text>
                      )}
                    </>
                  )}
                </g>
              );
            })}
            {labelled(i, data.length, stride) && (
              <>
                <text x={groupX + groupW / 2} y={baseline + 20} textAnchor="middle" fontSize={12} fill={MUTED}>
                  {shortDate(d.log_date)}
                </text>
                <text x={groupX + groupW / 2} y={baseline + 34} textAnchor="middle" fontSize={11} fill={MUTED}>
                  {d.day_of_week ?? ""}
                </text>
              </>
            )}
          </>
        );
        return dayHref ? (
          <a key={d.log_date} href={dayHref(d.log_date)} className="cursor-pointer">
            {body}
          </a>
        ) : (
          <g key={d.log_date}>{body}</g>
        );
      })}
    </svg>
  );
}

/** Always shown next to the chart — two series must never be told apart by hue alone. */
export function SupportLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs" style={{ color: "var(--text-secondary)" }}>
      {SUPPORT_EVENTS.map((e) => (
        <li key={e.key} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
            style={{ background: supportColor(e) }}
          />
          <span>{e.label}</span>
        </li>
      ))}
    </ul>
  );
}

export function BehaviorLegend({ behaviors = BEHAVIORS }: { behaviors?: Behavior[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs" style={{ color: "var(--text-secondary)" }}>
      {behaviors.map((b) => (
        <li key={b.code} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
            style={{ background: b.color }}
          />
          <span>
            {b.code}. {b.short}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------ one small chart per behavior */

export function BehaviorMiniChart({
  code,
  dates,
  values,
}: {
  code: number;
  dates: string[];
  values: number[];
}) {
  const behavior = BEHAVIORS.find((b) => b.code === code)!;
  const W = 300, H = 108;
  const M = { top: 14, right: 8, bottom: 20, left: 8 };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const total = values.reduce((a, b) => a + b, 0);
  const max = Math.max(...values, 1);
  const band = plotW / Math.max(values.length, 1);
  const barW = Math.min(18, band * 0.6);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
      aria-label={`${behavior.label}: ${total} total`}>
      <line x1={M.left} x2={W - M.right} y1={M.top + plotH} y2={M.top + plotH} stroke={AXIS} strokeWidth={1} />
      {values.map((value, i) => {
        const h = (value / max) * plotH;
        const x = M.left + i * band + (band - barW) / 2;
        return (
          <g key={dates[i]}>
            <title>{`${weekdayDate(dates[i])}: ${value}`}</title>
            {value > 0 && (
              <rect x={x} y={M.top + plotH - h} width={barW} height={h} rx={4} fill={behavior.color} />
            )}
            <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize={10} fill={MUTED}>
              {shortDate(dates[i])}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* --------------------------------------------------------- period × behavior */

export function PeriodHeatmap({
  periodTotals,
  periodBehavior,
  behaviors = BEHAVIORS,
}: {
  periodTotals: PeriodTotal[];
  periodBehavior: PeriodBehavior[];
  behaviors?: Behavior[];
}) {
  const lookup = new Map<string, number>();
  for (const row of periodBehavior) {
    lookup.set(`${row.period_key}:${row.code}`, row.count);
  }
  const max = Math.max(...periodBehavior.map((r) => r.count), 1);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <caption className="sr-only">
          Incidents by class period and behavior type. Darker cells mean more incidents.
        </caption>
        <thead>
          <tr>
            <th scope="col" className="p-2 text-left text-xs font-medium" style={{ color: MUTED }}>
              Class
            </th>
            {behaviors.map((b) => (
              <th
                key={b.code}
                scope="col"
                className="p-1 text-center text-xs font-medium"
                style={{ color: MUTED }}
                title={b.label}
              >
                {b.code}
              </th>
            ))}
            <th scope="col" className="p-2 text-right text-xs font-medium" style={{ color: MUTED }}>
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {periodTotals.map((period) => (
            <tr key={period.period_key}>
              <th scope="row" className="whitespace-nowrap p-2 text-left font-normal">
                {period.period_label}
                <span className="ml-1 text-xs" style={{ color: MUTED }}>
                  {period.time_range}
                </span>
              </th>
              {behaviors.map((b) => {
                const value = lookup.get(`${period.period_key}:${b.code}`) ?? 0;
                return (
                  <td
                    key={b.code}
                    className="p-0 text-center"
                    title={`${period.period_label} — ${b.label}: ${value}`}
                  >
                    <div
                      className="tnum m-[2px] rounded py-2 text-xs"
                      style={{
                        background: rampColor(value, max),
                        color: value > 0 ? rampInk(value, max) : MUTED,
                      }}
                    >
                      {value > 0 ? value : "·"}
                    </div>
                  </td>
                );
              })}
              <td className="tnum p-2 text-right font-semibold">{period.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ helpers */

function EmptyPlot({ label }: { label: string }) {
  return (
    <div
      className="flex h-40 items-center justify-center rounded-lg text-sm"
      style={{ color: MUTED, background: SURFACE }}
    >
      {label}
    </div>
  );
}

export function StatTile({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number;
  note?: string;
}) {
  return (
    <div className="card p-4">
      <p className="text-xs" style={{ color: MUTED }}>
        {label}
      </p>
      <p className="mt-1 text-3xl font-semibold leading-none">{value}</p>
      {note && (
        <p className="mt-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
          {note}
        </p>
      )}
    </div>
  );
}
