# Fix list

Outstanding fixes, TODOs, and known issues for the behavior log.

Add new items at the top. Use the format:

- [ ] YYYY-MM-DD — short description (file_path:line if relevant)

## Open

- [ ] 2026-09-16 — **Re-check the 9/10 log against the paper.** It was seeded at 66
      incidents, the highest day on record, against notes that read positively
      ("independently finished work", "completed math task with 3 redirects") — the
      over-count this session was opened to fix. Its Specials row is also marked
      "not present to see all behaviors" yet carries 10 tallies, which cannot both be
      true. Open `/day/2026-09-10`, photograph the original page (the button is on that
      page), then use "Fix these numbers". The same is worth doing for 9/8, 9/9, 9/11
      and 9/14, none of which have a photo either.
- [ ] 2026-09-16 — Deploy: Vercel project must be imported by hand; the Claude↔Vercel
      connection returns 403 on project creation. Once the project exists, set the five
      env vars and attach `hc.stationinsight.com`.
- [ ] 2026-09-16 — Confirm the dates on the 9/9 and 9/10 logs (both forms came home with
      a blank date box; they're flagged `date_confirmed = false` and editable in /data).
- [ ] 2026-09-16 — Verify the vision parser against a real photo end-to-end once
      `ANTHROPIC_API_KEY` is set, and compare its counts to the seeded rows for that date.
- [ ] 2026-09-16 — The five seeded September logs have no stored photo (they were
      transcribed from images in a chat, not uploaded), so the Pages gallery and the
      report's photo appendix are empty until the pages are photographed. A photo can now
      be attached to an existing day from `/day/<date>` without re-entering it, and the
      Pages tab lists the days still missing one.
- [ ] 2026-09-16 — Still uncovered by tests: the session cookie round-trip in
      `lib/session.ts`, PIN hashing in `lib/pin.ts`, and the CSV shape. (Tally counting
      and filtering/aggregation are covered.)
- [ ] 2026-09-16 — The period × behavior heatmap needs horizontal scrolling at phone
      width with all 8 behavior columns showing. Filtering to fewer behaviors fixes it,
      but a scroll affordance (or a stacked layout on narrow screens) would be better.

## Done

- [x] 2026-09-16 — Reading a photo returned `400 ... minItems values other than 0 or 1 are
      not supported`, so photo reading had never worked at all. A strict tool schema only
      accepts a subset of JSON Schema and `periods` declared `minItems: 10`. Removed, and a
      schema rejection now retries without strict rather than failing the upload; API errors
      are reported in plain language instead of raw JSON.
- [x] 2026-09-16 — Counting accuracy: the vision model now only transcribes the glyphs,
      and `lib/tally.ts` does the arithmetic; each photo is read twice and a disagreement
      keeps the lower count; not-observed-with-counts and counts-without-marks are flagged;
      the review screen prints the reason each row was flagged. Covered by
      `tests/tally.test.js`.
- [x] 2026-09-16 — A day opens its own page (`/day/<date>`) from the table, the day list,
      a bar on the daily chart or the Pages gallery: the photo, every period with the marks
      it was counted from, and an editor for correcting a miscount in place.

- [x] 2026-09-16 — Filtering across every view (behavior, class period, day of week, date
      range), carried in the URL and applied identically to charts, table, report and CSV.
- [x] 2026-09-16 — A test suite exists: `npm test` runs `tests/derive.test.js` on plain
      node, checking the filter/aggregation math against the real seeded numbers.
