/**
 * Training-label checks.
 *
 * What matters here is `corrected`: it is the flag that separates "the reader
 * got this right" from "a human had to fix it", and it's the whole point of
 * collecting the set. If it lies, the dataset teaches the wrong lesson.
 */
const { buildSamples, countsOf, boxFor } = require("../.test-build/samples.js");
const { fallbackLayout } = require("../.test-build/geometry.js");

let failures = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n        expected ${e}\n        got      ${a}`}`);
}
const c = (over) => {
  const out = { b1: 0, b2: 0, b3: 0, b4: 0, b5: 0, b6: 0, b7: 0, b8: 0 };
  for (const [k, v] of Object.entries(over ?? {})) out[`b${k}`] = v;
  return out;
};
const build = (rows, over = {}) =>
  buildSamples({
    log_id: "log-1",
    log_date: "2026-09-10",
    image_path: "2026-09-10-1.jpg",
    layout: fallbackLayout(),
    source: "review",
    rows,
    ...over,
  });

// --- counts are normalised, never trusted raw -------------------------------
check("counts fill in missing behaviors", countsOf({ b1: 3 }), c({ 1: 3 }));
check("negatives become zero", countsOf({ b1: -4 }), c({}));
check("counts are capped", countsOf({ b1: 500 }), c({ 1: 99 }));
check("fractions round", countsOf({ b1: 2.6 }), c({ 1: 3 }));
check("nonsense becomes zero", countsOf({ b1: "lots" }), c({}));
check("nothing at all is all zeros", countsOf(null), c({}));

// --- the corrected flag ------------------------------------------------------
const agreed = build([
  { period_key: "reading", model: c({ 1: 8 }), human: c({ 1: 8 }) },
])[0];
check("agreement is not a correction", agreed.corrected, false);

const fixed = build([
  { period_key: "reading", model: c({ 1: 8 }), human: c({ 1: 6 }) },
])[0];
check("a changed count is a correction", fixed.corrected, true);
check("the label is the human's number", fixed.human_counts, c({ 1: 6 }));
check("the machine's number is kept beside it", fixed.model_counts, c({ 1: 8 }));

const movedBehavior = build([
  // Same total, wrong behavior — 6 sixes read as 6 ones. Still a correction.
  { period_key: "math", model: c({ 1: 6 }), human: c({ 6: 6 }) },
])[0];
check("same total under a different behavior is a correction", movedBehavior.corrected, true);

const cleared = build([
  { period_key: "specials", model: c({ 1: 4, 6: 6 }), human: c({}), human_not_observed: true },
])[0];
check("clearing a not-observed row is a correction", cleared.corrected, true);
check("not_observed is carried onto the label", cleared.human_not_observed, true);

// --- provenance travels with the label ---------------------------------------
const one = build([
  {
    period_key: "writing",
    model_raw_tally: "1111111 2222 6666666",
    model_confidence: "medium",
    model: c({ 1: 7, 2: 4, 6: 7 }),
    human: c({ 1: 7, 2: 4, 6: 7 }),
  },
])[0];
check("the transcription is kept", one.model_raw_tally, "1111111 2222 6666666");
check("so is the confidence", one.model_confidence, "medium");
check("and the photo", one.image_path, "2026-09-10-1.jpg");
check("and the date", one.log_date, "2026-09-10");
check("and the source", one.source, "review");
check("corrections are labelled as such", build([
  { period_key: "writing", model: c({}), human: c({}) },
], { source: "correction" })[0].source, "correction");

// --- the crop box ------------------------------------------------------------
const fb = fallbackLayout();
const band = fb.bands.find((b) => b.period_key === "lunch");
check("the box is the row's band plus the table edges", boxFor(fb, "lunch"), {
  left: fb.left, right: fb.right, top: band.top, bottom: band.bottom,
});
check("no grid means no box", boxFor(null, "lunch"), null);
check("an unknown row has no box", boxFor(fb, "naptime"), null);
check("a sample with no grid still records", build([
  { period_key: "lunch", model: c({}), human: c({ 1: 2 }) },
], { layout: null })[0].box, null);

// --- shape -------------------------------------------------------------------
check("one sample per row in", build([
  { period_key: "reading", model: c({}), human: c({}) },
  { period_key: "math", model: c({}), human: c({}) },
]).length, 2);
check("no rows means no samples", build([]).length, 0);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
