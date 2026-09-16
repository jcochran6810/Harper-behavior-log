/**
 * Tally-counting checks. Same plain-node style as derive.test.js.
 *
 * These matter because the counting in lib/tally.ts is what the app trusts over
 * the vision model's own arithmetic: "1111" is four 1s, and if this file is
 * wrong then every corrected number downstream is wrong with it.
 */
const { readTally, totalOf, sameCounts, lowerOf, zeroCounts } = require("../.test-build/tally.js");

let failures = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n        expected ${e}\n        got      ${a}`}`);
}
/** Compact "counts" spelling: c({1:4, 6:2}). */
const c = (over) => {
  const out = zeroCounts();
  for (const [k, v] of Object.entries(over ?? {})) out[`b${k}`] = v;
  return out;
};

// --- repeated digits are glyph counts, not numbers -------------------------
check("1111 is four 1s", readTally("1111").counts, c({ 1: 4 }));
check("66666 is five 6s", readTally("66666").counts, c({ 6: 5 }));
check("a single 8 is one 8", readTally("8").counts, c({ 8: 1 }));
check("clusters sum across the cell", readTally("11111111 666 22").counts, c({ 1: 8, 6: 3, 2: 2 }));
check("the same digit in two clusters adds up", readTally("11 66 111").counts, c({ 1: 5, 6: 2 }));
check("runs run together are still separate", readTally("11116666").counts, c({ 1: 4, 6: 4 }));

// --- the teacher's other glyph styles --------------------------------------
check("vertical strokes are 1s", readTally("||||||").counts, c({ 1: 6 }));
check("lowercase l strokes are 1s", readTally("llll").counts, c({ 1: 4 }));
check("a cursive loop chain is 6s", readTally("lelelele").counts, c({ 6: 4 }));
check("an ec chain is 6s", readTally("ececec").counts, c({ 6: 3 }));
// From the real 9/9 page: the Reading cell reads "III SSS 2222 lolololo".
check("an lo chain is 6s", readTally("lolololo").counts, c({ 6: 4 }));
check("9/9 reading row, whole cell", readTally("III SSS 2222 lolololo").counts,
  c({ 1: 3, 5: 3, 2: 4, 6: 4 }));
check("S glyphs are 5s", readTally("SSS").counts, c({ 5: 3 }));

// --- separators the transcription might use --------------------------------
check("commas separate clusters", readTally("111, 666").counts, c({ 1: 3, 6: 3 }));
check("middots separate clusters", readTally("22 · 44").counts, c({ 2: 2, 4: 2 }));
check("extra whitespace is harmless", readTally("  111   22  ").counts, c({ 1: 3, 2: 2 }));

// --- nothing there ---------------------------------------------------------
check("null reads as empty", readTally(null).empty, true);
check("empty string reads as empty", readTally("  ").empty, true);
check("an empty read is still understood", readTally(null).understood, true);
check("an empty read is all zeros", readTally(null).counts, zeroCounts());

// --- things we must NOT silently count -------------------------------------
const prose = readTally("threw shoes");
check("prose isn't a tally", prose.counts, zeroCounts());
check("prose is flagged as not understood", prose.understood, false);
check("prose is reported back to the reviewer", prose.unknown, ["threw", "shoes"]);

const mixed = readTally("111 scribble");
check("a readable cluster still counts", mixed.counts, c({ 1: 3 }));
check("but the row is flagged", mixed.understood, false);

// 9 and 0 aren't behaviors on this form — never invent a b9.
const nine = readTally("999");
check("9s are not a behavior", nine.counts, zeroCounts());
check("9s flag the row", nine.understood, false);

// --- helpers ---------------------------------------------------------------
check("totalOf sums every behavior", totalOf(c({ 1: 8, 6: 3, 2: 2 })), 13);
check("sameCounts on equal readings", sameCounts(c({ 1: 4 }), c({ 1: 4 })), true);
check("sameCounts on a one-off miscount", sameCounts(c({ 1: 4 }), c({ 1: 5 })), false);
check("lowerOf takes the smaller per behavior",
  lowerOf(c({ 1: 8, 6: 3 }), c({ 1: 6, 6: 5 })), c({ 1: 6, 6: 3 }));

// --- the real 9/10 rows, which is what started all this ---------------------
// Every seeded 9/10 cell must count back to exactly what was stored, or the
// stored number came from somewhere other than the marks on the page.
check("9/10 reading row", readTally("11111111 666 22").counts, c({ 1: 8, 6: 3, 2: 2 }));
check("9/10 writing row", readTally("1111111 2222 6666666").counts, c({ 1: 7, 2: 4, 6: 7 }));
check("9/10 math row", readTally("11111111 6666").counts, c({ 1: 8, 6: 4 }));

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
