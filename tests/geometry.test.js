/**
 * Row-grid checks. Same plain-node style as the other suites.
 *
 * The stake here is a box drawn over the wrong row: a parent taps "Reading",
 * edits what they see, and the numbers land on Writing. So most of these check
 * that a questionable grid is REJECTED rather than repaired — a rejected grid
 * becomes an even split that is obviously approximate, which is honest.
 */
const {
  normalizeLayout,
  fallbackLayout,
  rescaleBands,
  averageLayouts,
  layoutDrift,
  bandFor,
} = require("../.test-build/geometry.js");
const { PERIOD_KEYS } = require("../.test-build/behaviors.js");

let failures = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n        expected ${e}\n        got      ${a}`}`);
}
const close = (name, actual, expected, tol = 1e-9) => {
  const ok = Math.abs(actual - expected) < tol;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n        expected ${expected}\n        got      ${actual}`}`);
};

/** Ten evenly stacked rows between top and bottom — a well-formed grid. */
function grid(top = 0.26, bottom = 0.96, over = {}) {
  const h = (bottom - top) / PERIOD_KEYS.length;
  return {
    left: 0.02,
    right: 0.98,
    bands: PERIOD_KEYS.map((period_key, i) => ({
      period_key,
      top: top + i * h,
      bottom: top + (i + 1) * h,
    })),
    ...over,
  };
}

// --- a good grid survives intact --------------------------------------------
const good = normalizeLayout(grid());
check("a well-formed grid is accepted", good !== null, true);
check("it keeps all ten rows", good.bands.length, 10);
check("in schedule order", good.bands.map((b) => b.period_key), PERIOD_KEYS);

// --- the fallback is always usable ------------------------------------------
const fb = fallbackLayout();
check("the fallback has ten rows", fb.bands.length, 10);
check("the fallback validates", normalizeLayout(fb) !== null, true);
check("the fallback rows touch", fb.bands[1].top, fb.bands[0].bottom);
check("the fallback clears the printed legend", fb.bands[0].top >= 0.2, true);

// --- rejections: each of these would put a box on the wrong row -------------
// Array order is irrelevant — each band names its own row — but coordinates
// running UP the page mean the reader has the rows inverted.
const shuffled = grid();
const coords = shuffled.bands.map((b) => ({ top: b.top, bottom: b.bottom })).reverse();
check("array order alone doesn't matter", normalizeLayout({
  ...grid(),
  bands: [...grid().bands].reverse(),
}) !== null, true);
check("rows running up the page are rejected", normalizeLayout({
  ...shuffled,
  bands: shuffled.bands.map((b, i) => ({ period_key: b.period_key, ...coords[i] })),
}), null);

const overlapping = grid();
overlapping.bands[4].top = 0.1; // row 5 jumps above row 4
check("a row jumping up the page is rejected", normalizeLayout(overlapping), null);

const missing = grid();
missing.bands.splice(3, 1);
check("a missing row rejects the whole grid", normalizeLayout(missing), null);

const flat = grid();
flat.bands[2].bottom = flat.bands[2].top;
check("a zero-height row is rejected", normalizeLayout(flat), null);

const offPage = grid();
offPage.bands[9].bottom = 1.4;
check("a row past the bottom edge is rejected", normalizeLayout(offPage), null);

check("a sliver-wide table is rejected", normalizeLayout(grid(0.26, 0.96, { left: 0.4, right: 0.5 })), null);
check("a right edge left of the left edge is rejected",
  normalizeLayout(grid(0.26, 0.96, { left: 0.9, right: 0.1 })), null);
check("nothing at all is rejected", normalizeLayout(null), null);
check("a bare object is rejected", normalizeLayout({}), null);
check("non-numeric edges are rejected", normalizeLayout(grid(0.26, 0.96, { left: "x" })), null);

const unknownRow = grid();
unknownRow.bands[0].period_key = "naptime";
check("an unknown row name rejects the grid", normalizeLayout(unknownRow), null);

// --- rescaling: what the two drag handles do --------------------------------
const scaled = rescaleBands(normalizeLayout(grid(0.3, 0.9)), 0.2, 0.8);
close("dragging sets the first row's top", scaled.bands[0].top, 0.2);
close("and the last row's bottom", scaled.bands[9].bottom, 0.8);
check("a rescaled grid still validates", normalizeLayout(scaled) !== null, true);
close("rows keep their share of the height", scaled.bands[1].top - scaled.bands[0].top, 0.06, 1e-9);
check("rescaled rows still touch", scaled.bands[3].bottom, scaled.bands[4].top);

// --- combining two independent reads ----------------------------------------
const a = normalizeLayout(grid(0.2, 0.9));
const b = normalizeLayout(grid(0.3, 1.0));
close("averaging splits the difference", averageLayouts(a, b).bands[0].top, 0.25);
close("drift is the worst single disagreement", layoutDrift(a, b), 0.1, 1e-9);
close("a grid doesn't drift from itself", layoutDrift(a, a), 0);

// --- lookup ------------------------------------------------------------------
check("bandFor finds a row", bandFor(good, "lunch").period_key, "lunch");
check("bandFor on a missing row", bandFor(good, "naptime"), null);
check("bandFor with no grid", bandFor(null, "lunch"), null);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
