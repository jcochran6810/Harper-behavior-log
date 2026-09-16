/**
 * Filter + aggregation checks. No test framework on purpose: this runs on plain
 * node against compiled output, so `npm test` works anywhere without a devDep.
 *
 * The fixture is the five real September logs, extracted from
 * supabase/seed_september.sql. The unfiltered expectations below are the numbers
 * the SQL views return for that same data, so an unfiltered run cross-checks the
 * TypeScript aggregation in lib/derive.ts against the database's own view SQL.
 */
const { buildDataset } = require("../.test-build/derive.js");
const { EMPTY_FILTERS } = require("../.test-build/filters.js");
const logs = require("./fixtures/september.json");

let failures = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n        expected ${e}\n        got      ${a}`}`);
}
const f = (over) => ({ ...EMPTY_FILTERS, ...over });
const total = (d) => d.dailyTotals.reduce((s, x) => s + x.total, 0);

// --- unfiltered: must reproduce the database exactly -----------------------
let d = buildDataset(logs, f({}));
check("unfiltered days", d.dailyTotals.length, 5);
check("unfiltered total", total(d), 228);
check("unfiltered daily series", d.dailyTotals.map((x) => x.total), [58, 17, 66, 36, 51]);
check("unfiltered dates ascending", d.dailyTotals.map((x) => x.log_date),
  ["2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-14"]);
check("unfiltered period ranking",
  [...d.periodTotals].sort((a, b) => b.total - a.total).slice(0, 5).map((p) => `${p.period_label}=${p.total}`),
  ["Writing=76", "Reading=75", "Math Continued=35", "Math=32", "Specials=10"]);

const behaviourTotals = (d) =>
  d.behaviors.map((b) => `${b.short}=${d.behaviorDaily.filter((r) => r.code === b.code).reduce((s, r) => s + r.count, 0)}`);
check("unfiltered behavior totals", behaviourTotals(d),
  ["Interrupting=96", "Shouting=32", "Supplies=11", "Aggression=13", "Cutting=7", "Refusal=63", "Shoes off=4", "Snacking=2"]);

// --- one behavior: totals narrow, the day denominator does not -------------
d = buildDataset(logs, f({ behaviors: [4] }));
check("behavior 4 total", total(d), 13);
check("behavior 4 keeps all 5 days", d.dailyTotals.length, 5);
check("behavior 4 columns", d.behaviors.map((b) => b.code), [4]);

// --- one class period ------------------------------------------------------
d = buildDataset(logs, f({ periods: ["writing"] }));
check("writing total", total(d), 76);
check("writing rows only", d.periodTotals.map((p) => p.period_key), ["writing"]);

// --- one weekday -----------------------------------------------------------
d = buildDataset(logs, f({ weekdays: ["Mon"] }));
check("Monday only", d.dailyTotals.map((x) => `${x.log_date}=${x.total}`), ["2026-09-14=51"]);

// --- a custom date window --------------------------------------------------
d = buildDataset(logs, f({ range: "custom", from: "2026-09-09", to: "2026-09-11" }));
check("9/9-9/11 window", total(d), 119);

// --- dimensions compose ----------------------------------------------------
d = buildDataset(logs, f({ behaviors: [1], periods: ["reading"] }));
check("interrupting during reading", total(d), 31);

d = buildDataset(logs, f({ behaviors: [6], weekdays: ["Thu"] }));
check("refusal on Thursdays", total(d), 26);

// --- a slice with nothing in it --------------------------------------------
d = buildDataset(logs, f({ behaviors: [8], periods: ["recess"] }));
check("snacking at recess is empty", total(d), 0);
check("...but the days are still counted", d.dailyTotals.length, 5);

// --- totals stay internally consistent under any filter --------------------
d = buildDataset(logs, f({ behaviors: [1, 6], periods: ["reading", "writing"] }));
check("daily totals == sum of behaviorDaily", total(d), d.behaviorDaily.reduce((s, r) => s + r.count, 0));
check("daily totals == sum of periodTotals", total(d), d.periodTotals.reduce((s, p) => s + p.total, 0));
check("daily totals == sum of periodBehavior", total(d), d.periodBehavior.reduce((s, r) => s + r.count, 0));

// --- the URL contract ------------------------------------------------------
const { parseFilters, serializeFilters } = require("../.test-build/filters.js");

const roundTrip = (over) => {
  const start = f(over);
  const parsed = parseFilters(Object.fromEntries(new URLSearchParams(serializeFilters(start))));
  return parsed;
};
check("round-trip: behaviors", roundTrip({ behaviors: [1, 6] }).behaviors, [1, 6]);
check("round-trip: periods", roundTrip({ periods: ["reading", "writing"] }).periods, ["reading", "writing"]);
check("round-trip: weekdays", roundTrip({ weekdays: ["Mon", "Thu"] }).weekdays, ["Mon", "Thu"]);
check("round-trip: custom window",
  (({ range, from, to }) => ({ range, from, to }))(roundTrip({ range: "custom", from: "2026-09-09", to: "2026-09-11" })),
  { range: "custom", from: "2026-09-09", to: "2026-09-11" });
check("defaults serialize to an empty query", serializeFilters(f({})), "");

// Junk in the query string must never widen or crash a view.
const junk = parseFilters({ b: "9,0,cat", p: "lunchroom", d: "Sun", range: "forever", from: "nope" });
check("junk behaviors dropped", junk.behaviors, []);
check("junk periods dropped", junk.periods, []);
check("junk weekdays dropped", junk.weekdays, []);
check("junk range falls back to all", junk.range, "all");
check("junk date dropped", junk.from, null);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
