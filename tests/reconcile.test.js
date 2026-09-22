/**
 * Checks on the rule that decides what a close-up reading of a row is allowed to
 * do to the number that came off the whole page.
 *
 * The whole point of the second pass is to catch a run of seven that was read as
 * eight. The danger is that it introduces a new way to be wrong — a crop over
 * the wrong strip of paper, or one that catches the row above. So most of what
 * follows asserts the LIMITS on the close-up read, not its powers:
 *
 *   - it may lower a count, or confirm one
 *   - it may never raise one
 *   - it may never zero a row that the page said had marks
 *   - the stored numbers must always still match the stored transcription
 */
const { reconcileRow, rowsWorthZooming, worseOf, countsFromRow } = require("../.test-build/reconcile.js");
const { readTally, totalOf, zeroCounts } = require("../.test-build/tally.js");

let failures = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n        expected ${e}\n        got      ${a}`}`);
}
function ok(name, cond) {
  if (!cond) failures++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
}

const c = (over) => {
  const out = zeroCounts();
  for (const [k, v] of Object.entries(over ?? {})) out[`b${k}`] = v;
  return out;
};

/** A row as the page read left it, counts derived from its own transcription. */
const page = (raw, extra) => ({
  period_key: "reading",
  raw_tally: raw,
  not_observed: false,
  confidence: "high",
  counts: readTally(raw).counts,
  ...extra,
});

const zoom = (raw, extra) => ({
  period_key: "reading",
  raw_tally: raw,
  confidence: "high",
  ...extra,
});

// --- agreement -------------------------------------------------------------
{
  const out = reconcileRow(page("1111 666"), zoom("1111 666"));
  check("two readings that agree keep the count", out.counts, c({ 1: 4, 6: 3 }));
  check("agreement raises no flag", out.flags, []);
  check("agreement keeps the page transcription", out.raw_tally, "1111 666");
  check("agreement keeps high confidence", out.confidence, "high");
}
{
  // Same counts, different spelling of the same glyphs: still agreement.
  const out = reconcileRow(page("|||| 666"), zoom("1111 lololo"));
  check("different spellings of the same counts agree", out.counts, c({ 1: 4, 6: 3 }));
  check("agreement across spellings raises no flag", out.flags, []);
}
{
  const out = reconcileRow(page("1111"), zoom("1111", { confidence: "low" }));
  check("an unsure close-up drags the confidence down", out.confidence, "low");
}

// --- the close-up read fewer marks: this is the bug it exists to catch ------
{
  // The real shape of the complaint: a run of eight that is really seven.
  const out = reconcileRow(page("11111111 666"), zoom("1111111 666"));
  check("a padded run is brought back down", out.counts, c({ 1: 7, 6: 3 }));
  check("the lower count comes with its own transcription", out.raw_tally, "1111111 666");
  check("counts still match the stored marks", out.counts, readTally(out.raw_tally).counts);
  check("the row is flagged for a human", out.flags.length, 1);
  check("and marked unsure", out.confidence, "low");
  check("the outcome names the close-up as its source", out.source, "close-up");
  ok("the flag says what the whole page had read", out.flags[0].includes("11111111 666"));
}
{
  const out = reconcileRow(page("11111111 6666"), zoom("111111 6666"));
  check("a two-mark overcount is corrected", out.counts, c({ 1: 6, 6: 4 }));
}

// --- the close-up read MORE marks: never allowed to raise the number -------
{
  const out = reconcileRow(page("1111 666"), zoom("111111 666"));
  check("a higher close-up does NOT raise the count", out.counts, c({ 1: 4, 6: 3 }));
  check("the page transcription is kept with it", out.raw_tally, "1111 666");
  check("counts still match the stored marks", out.counts, readTally(out.raw_tally).counts);
  check("but the row is flagged", out.flags.length, 1);
  ok("the flag quotes what the close-up saw", out.flags[0].includes("111111 666"));
  check("the number that stands came from the page", out.source, "page");
}
{
  // Mixed: fewer 1s but more 6s. Total decides, and the winning transcription
  // travels with it, so the counts-match-marks invariant holds either way.
  const fewer = reconcileRow(page("11111111 66"), zoom("111 666666"));
  check("mixed, close-up total lower: close-up wins", fewer.counts, readTally("111 666666").counts);
  check("mixed low: marks still match", fewer.counts, readTally(fewer.raw_tally).counts);
  const more = reconcileRow(page("111 666666"), zoom("11111111 66666555"));
  check("mixed, close-up total higher: page stands", more.counts, readTally("111 666666").counts);
  check("mixed high: marks still match", more.counts, readTally(more.raw_tally).counts);
}

// --- an empty close-up over a row the page said had marks -----------------
{
  // Almost always a box over the wrong strip of paper. Zeroing a real row on a
  // cropping error would look like the app losing data, so the page stands.
  const out = reconcileRow(page("11111111 666"), zoom(null));
  check("an empty close-up does not zero a row with marks", out.counts, c({ 1: 8, 6: 3 }));
  check("it is flagged instead", out.flags.length, 1);
  ok("the flag blames the box, not the marks", out.flags[0].includes("wrong part of the page"));
  check("and marked unsure", out.confidence, "low");
}
{
  const out = reconcileRow(page(null), zoom(null));
  check("both empty is agreement, not a problem", out.flags, []);
  check("both empty counts nothing", totalOf(out.counts), 0);
}

// --- failures and unreadable crops ----------------------------------------
{
  const out = reconcileRow(page("1111"), zoom(null, { error: "timed out" }));
  check("a failed close-up leaves the page count alone", out.counts, c({ 1: 4 }));
  check("a failed close-up is reported", out.flags.length, 1);
  ok("it says the check didn't complete", out.flags[0].includes("didn't complete"));
}
{
  const out = reconcileRow(page("1111"), zoom("qqq zzz"));
  check("an uncountable close-up leaves the page count alone", out.counts, c({ 1: 4 }));
  check("an uncountable close-up is flagged", out.flags.length, 1);
  check("and drops confidence", out.confidence, "low");
}
{
  const out = reconcileRow(page("1111"), null);
  check("no close-up at all is not a flag", out.flags, []);
  check("no close-up keeps the page count", out.counts, c({ 1: 4 }));
}

// --- a period the teacher couldn't watch ----------------------------------
{
  const notObserved = { ...page(null), not_observed: true, counts: c({ 1: 4 }) };
  const out = reconcileRow(notObserved, zoom("1111"));
  check("a not-observed row is left exactly as it was", out.counts, c({ 1: 4 }));
  check("a not-observed row isn't argued with", out.flags, []);
}

// --- which rows are worth a close-up -------------------------------------
{
  const rows = [
    page("1111", { period_key: "reading" }),
    { ...page(null), period_key: "recess" },
    { ...page(null), period_key: "lunch", not_observed: true },
    { ...page(null), period_key: "math", counts: c({ 6: 3 }) },
    { ...page("1111"), period_key: "specials", not_observed: true },
  ];
  check("only rows where a number could be wrong are zoomed", rowsWorthZooming(rows), [
    "reading",
    "math",
  ]);
}

// --- the real 9/10 rows, as the seed recorded them ------------------------
// These are the cells behind the complaint that opened this work: every one is a
// long run of 1s and 6s next to a note that reads positively. A close-up that
// reads one fewer glyph per run takes the day from 56 down to 51.
{
  const cells = [
    ["11111111 666 22", "1111111 666 22"],
    ["1111111 2222 6666666", "111111 2222 6666666"],
    ["11111111 6666", "1111111 6666"],
    ["1111111 666666", "111111 666666"],
  ];
  let before = 0;
  let after = 0;
  for (const [pageRaw, zoomRaw] of cells) {
    const out = reconcileRow(page(pageRaw), zoom(zoomRaw));
    before += totalOf(readTally(pageRaw).counts);
    after += totalOf(out.counts);
    ok(`9/10 "${pageRaw}" is flagged when the close-up differs`, out.flags.length === 1);
  }
  check("the four 9/10 cells as transcribed", before, 56);
  check("one fewer mark per run of 1s", after, 52);
}

// --- confidence ordering --------------------------------------------------
check("worseOf picks the worse", worseOf("high", "low"), "low");
check("worseOf is order-independent", worseOf("low", "high"), "low");
check("worseOf of two highs is high", worseOf("high", "high"), "high");

// --- countsFromRow reads a database row ----------------------------------
check("countsFromRow pulls b1..b8", countsFromRow({ b1: 3, b6: 2, notes: "x" }), c({ 1: 3, 6: 2 }));
check("countsFromRow treats missing as zero", totalOf(countsFromRow({})), 0);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
