/**
 * Checks on the two counts that are NOT behaviors: how often another adult was
 * called into the room, and how often Harper was taken out of it.
 *
 * They are recorded once per DAY, from the box at the top of the paper form, which
 * makes their filtering behaviour deliberately unlike everything else in the app:
 *
 *  - The behavior filter cannot narrow them. Filtering to "aggression only" must
 *    not make it look as though assistance was called less often than it was.
 *  - The CLASS-PERIOD filter cannot narrow them either, because the form never
 *    says which class a removal happened in. "Writing only" still reports the
 *    whole day's figure, and the UI says as much.
 *  - Only the filters that pick whole days — the date window and the day of week —
 *    change them.
 *
 * Getting that wrong in either direction produces a filtered report that misstates
 * the support the classroom needed, which is the exact figure someone would be
 * reading the report to find.
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

/** One period row. No support fields live here any more — they belong to the day. */
function period(key, behaviors) {
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
    assistance_count: 1,
    removed_count: 0,
    support_confirmed_at: "2026-09-16T18:00:00Z",
    harper_log_periods: [period("writing", { b6: 5 }), period("science", {})],
  },
  {
    id: "d2",
    log_date: "2026-09-15",
    day_of_week: "Tue",
    date_confirmed: true,
    overall_note: null,
    image_path: null,
    verified_at: null,
    assistance_count: 0,
    removed_count: 2,
    // Reported two removals but nobody has ticked the box.
    support_confirmed_at: null,
    harper_log_periods: [period("reading", {}), period("math", { b1: 2 })],
  },
  {
    // No support fields at all — a day saved before the columns existed.
    id: "d1",
    log_date: "2026-09-14",
    day_of_week: "Mon",
    date_confirmed: true,
    overall_note: null,
    image_path: null,
    verified_at: null,
    harper_log_periods: [period("reading", { b1: 4 }), period("math", { b4: 3 })],
  },
];

const incidents = (d) => d.dailyTotals.reduce((s, x) => s + x.total, 0);

// --- unfiltered ------------------------------------------------------------
let d = buildDataset(logs, f({}));
check("three days", d.dailyTotals.length, 3);
check("incident total is behaviors only", incidents(d), 14);
check("assistance total", d.support.assistance, 1);
check("removal total", d.support.removed, 2);
check("assistance per day, oldest first", d.dailyTotals.map((x) => x.assistance), [0, 0, 1]);
check("removals per day, oldest first", d.dailyTotals.map((x) => x.removed), [0, 2, 0]);

// A day saved before these columns existed reads as zero, not NaN or undefined.
check("a day with no support fields counts as zero",
  d.dailyTotals.find((x) => x.log_date === "2026-09-14").assistance, 0);

// --- neither count is folded into the incident totals ----------------------
// 14 incidents, 1 assistance call, 2 removals. Any leak would show up here.
check("support is not added to daily totals", d.dailyTotals.map((x) => x.total), [7, 2, 5]);
// Schedule order, not size order: Writing sits before Math in the school day.
check("support is not added to period totals",
  d.periodTotals.filter((p) => p.total > 0).map((p) => `${p.period_key}=${p.total}`),
  ["reading=4", "writing=5", "math=5"]);

// --- THE RULE: the behavior filter must not narrow these ------------------
d = buildDataset(logs, f({ behaviors: [4] }));
check("behavior 4 narrows incidents", incidents(d), 3);
check("behavior 4 does NOT narrow assistance", d.support.assistance, 1);
check("behavior 4 does NOT narrow removals", d.support.removed, 2);
check("behavior 4 keeps every day's removals", d.dailyTotals.map((x) => x.removed), [0, 2, 0]);

d = buildDataset(logs, f({ behaviors: [8] }));
check("a behavior with no incidents still shows the support", d.support.removed, 2);
check("and no incidents", incidents(d), 0);

// --- nor does the class-period filter, because the form never says which class -
// This is the one that would be easy to get wrong. The counts belong to the day,
// so a view scoped to Reading still reports the whole day's figure. Narrowing it
// would be inventing a per-class number the paper does not contain.
d = buildDataset(logs, f({ periods: ["reading"] }));
check("reading only narrows incidents", incidents(d), 4);
check("reading only does NOT narrow assistance", d.support.assistance, 1);
check("reading only does NOT narrow removals", d.support.removed, 2);

d = buildDataset(logs, f({ periods: ["science"] }));
check("a class with no incidents still reports the day's support", d.support.removed, 2);

// --- only the filters that pick whole days change them ------------------
d = buildDataset(logs, f({ weekdays: ["Mon"] }));
check("Monday only: assistance", d.support.assistance, 0);
check("Monday only: removals", d.support.removed, 0);

d = buildDataset(logs, f({ weekdays: ["Tue"] }));
check("Tuesday only: removals", d.support.removed, 2);

// --- and the date window ------------------------------------------------
d = buildDataset(logs, f({ range: "custom", from: "2026-09-15", to: "2026-09-16" }));
check("last two days: assistance", d.support.assistance, 1);
check("last two days: removals", d.support.removed, 2);

d = buildDataset(logs, f({ range: "custom", from: "2026-09-16", to: "2026-09-16" }));
check("one day: assistance", d.support.assistance, 1);
check("one day: removals", d.support.removed, 0);

// --- the day totals are what the tables and the report print ------------
d = buildDataset(logs, f({}));
check("the days something happened on, oldest first",
  d.dailyTotals
    .filter((x) => x.assistance > 0 || x.removed > 0)
    .map((x) => `${x.log_date}: ${x.assistance} called, ${x.removed} removed`),
  ["2026-09-15: 0 called, 2 removed", "2026-09-16: 1 called, 0 removed"]);
check("the day totals add up to the slice totals",
  [
    d.dailyTotals.reduce((a, x) => a + x.assistance, 0),
    d.dailyTotals.reduce((a, x) => a + x.removed, 0),
  ],
  [d.support.assistance, d.support.removed]);

// --- the confirmation tick ---------------------------------------------
// These two are the only numbers in the app read out of sentences rather than
// counted off marks, so whether a person vouched for them is carried alongside
// them and never inferred from the day merely being saved.
d = buildDataset(logs, f({}));
check("confirmation rides with the day",
  d.dailyTotals.map((x) => `${x.log_date}=${x.support_confirmed}`),
  ["2026-09-14=false", "2026-09-15=false", "2026-09-16=true"]);
check("a day with no column at all reads as unconfirmed",
  d.dailyTotals.find((x) => x.log_date === "2026-09-14").support_confirmed, false);
check("reporting events without ticking stays unconfirmed",
  d.dailyTotals.find((x) => x.log_date === "2026-09-15").support_confirmed, false);

// The report counts confirmations only among the days that actually reported
// something — a quiet day has nothing to vouch for and must not dilute the tally.
{
  const reported = d.dailyTotals.filter((x) => x.assistance > 0 || x.removed > 0);
  check("days that reported an event", reported.length, 2);
  check("of those, the confirmed ones", reported.filter((x) => x.support_confirmed).length, 1);
}

// Confirmation is independent of `verified`: one says the day was checked against
// the page, the other says these two figures specifically were vouched for.
check("confirmation is not the same field as verified",
  d.dailyTotals.map((x) => `${x.verified}/${x.support_confirmed}`),
  ["false/false", "false/false", "false/true"]);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
