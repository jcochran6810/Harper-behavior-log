/**
 * Checks on the two counts that are NOT behaviors: how often another adult was
 * called into the room, and how often Harper was taken out of it.
 *
 * The rule worth protecting here is the awkward one. Every other number in the
 * app narrows when you filter to one behavior, because every other number IS a
 * behavior count. These two are not. Filtering to "aggression only" must not make
 * it look as though assistance was called less often than it was — that would be
 * a filtered report quietly understating the support the classroom needed, which
 * is the exact figure someone would be reading the report to find.
 *
 * Its own fixture on purpose: tests/fixtures/september.json holds real seeded data
 * whose expectations are cross-checked against the database's own view SQL, and
 * inventing support numbers into it would spoil that.
 */
const { buildDataset } = require("../.test-build/derive.js");
const { EMPTY_FILTERS } = require("../.test-build/filters.js");

let failures = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n        expected ${e}\n        got      ${a}`}`);
}
const f = (over) => ({ ...EMPTY_FILTERS, ...over });

const zeros = { b1: 0, b2: 0, b3: 0, b4: 0, b5: 0, b6: 0, b7: 0, b8: 0 };

/** One period row. `support` omitted entirely models a row saved before these existed. */
function period(key, behaviors, support) {
  const bs = { ...zeros, ...behaviors };
  const total = Object.values(bs).reduce((a, b) => a + b, 0);
  return {
    id: `${key}-row`,
    period_key: key,
    specials_subject: null,
    antecedent: null,
    notes: null,
    raw_tally: null,
    smiley_count: 0,
    not_observed: false,
    confidence: "high",
    total,
    ...bs,
    ...(support ?? {}),
  };
}

const logs = [
  {
    id: "d3",
    log_date: "2026-09-16",
    day_of_week: "Wed",
    date_confirmed: true,
    overall_note: null,
    image_path: null,
    verified_at: null,
    harper_log_periods: [
      period("writing", { b6: 5 }, { assistance_count: 1, removed_count: 0 }),
      // No support fields at all — a row from before the columns existed.
      period("science", { b1: 0 }),
    ],
  },
  {
    id: "d2",
    log_date: "2026-09-15",
    day_of_week: "Tue",
    date_confirmed: true,
    overall_note: null,
    image_path: null,
    verified_at: null,
    harper_log_periods: [
      period("reading", {}, { assistance_count: 0, removed_count: 0 }),
      period("math", { b1: 2 }, { assistance_count: 0, removed_count: 2 }),
    ],
  },
  {
    id: "d1",
    log_date: "2026-09-14",
    day_of_week: "Mon",
    date_confirmed: true,
    overall_note: null,
    image_path: null,
    verified_at: null,
    harper_log_periods: [
      period("reading", { b1: 4 }, { assistance_count: 2, removed_count: 1 }),
      period("math", { b4: 3 }, { assistance_count: 1, removed_count: 0 }),
    ],
  },
];

const incidents = (d) => d.dailyTotals.reduce((s, x) => s + x.total, 0);

// --- unfiltered ------------------------------------------------------------
let d = buildDataset(logs, f({}));
check("three days", d.dailyTotals.length, 3);
check("incident total is behaviors only", incidents(d), 14);
check("assistance total", d.support.assistance, 4);
check("removal total", d.support.removed, 3);
check("assistance per day, oldest first", d.dailyTotals.map((x) => x.assistance), [3, 0, 1]);
check("removals per day, oldest first", d.dailyTotals.map((x) => x.removed), [1, 2, 0]);

// A row saved before these columns existed reads as zero, not as NaN or undefined.
check("a row with no support fields counts as zero",
  d.dailyTotals.find((x) => x.log_date === "2026-09-16").assistance, 1);

// --- neither count is folded into the incident totals ----------------------
// 14 incidents, 4 assistance calls, 3 removals. If any of the 7 support events
// had leaked into the incident count this would read 17, 18 or 21.
check("support is not added to daily totals", d.dailyTotals.map((x) => x.total), [7, 2, 5]);
// Schedule order, not size order: Writing sits before Math in the school day.
check("support is not added to period totals",
  d.periodTotals.filter((p) => p.total > 0).map((p) => `${p.period_key}=${p.total}`),
  ["reading=4", "writing=5", "math=5"]);

// --- THE RULE: the behavior filter must not narrow these ------------------
d = buildDataset(logs, f({ behaviors: [4] }));
check("behavior 4 narrows incidents", incidents(d), 3);
check("behavior 4 does NOT narrow assistance", d.support.assistance, 4);
check("behavior 4 does NOT narrow removals", d.support.removed, 3);
check("behavior 4 keeps every day's assistance", d.dailyTotals.map((x) => x.assistance), [3, 0, 1]);

d = buildDataset(logs, f({ behaviors: [8] }));
check("a behavior with no incidents still shows the support", d.support.assistance, 4);
check("and no incidents", incidents(d), 0);

// --- but the class-period filter does ------------------------------------
d = buildDataset(logs, f({ periods: ["reading"] }));
check("reading only: assistance", d.support.assistance, 2);
check("reading only: removals", d.support.removed, 1);

d = buildDataset(logs, f({ periods: ["math"] }));
check("math only: assistance", d.support.assistance, 1);
check("math only: removals", d.support.removed, 2);

// --- and so does the day of week ----------------------------------------
d = buildDataset(logs, f({ weekdays: ["Mon"] }));
check("Monday only: assistance", d.support.assistance, 3);
check("Monday only: removals", d.support.removed, 1);

// --- and the date window ------------------------------------------------
d = buildDataset(logs, f({ range: "custom", from: "2026-09-15", to: "2026-09-16" }));
check("last two days: assistance", d.support.assistance, 1);
check("last two days: removals", d.support.removed, 2);

// --- per-period breakdown, which is the staffing argument ---------------
d = buildDataset(logs, f({}));
check("support by period",
  d.periodTotals
    .filter((p) => p.assistance > 0 || p.removed > 0)
    .map((p) => `${p.period_key}: ${p.assistance} called, ${p.removed} removed`),
  ["reading: 2 called, 1 removed", "writing: 1 called, 0 removed", "math: 1 called, 2 removed"]);

// A class with incidents but no support events is absent from that list, and a
// class with support but no incidents would still appear.
check("a class with incidents but no support isn't listed",
  d.periodTotals.filter((p) => p.assistance === 0 && p.removed === 0 && p.total > 0).map((p) => p.period_key),
  []);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
