# Fix list

Outstanding fixes, TODOs, and known issues for the behavior log.

Add new items at the top. Use the format:

- [ ] YYYY-MM-DD — short description (file_path:line if relevant)

## Open

- [ ] 2026-09-22 — **The database is empty — start from photographs.** The five seeded
      September days were deleted at the user's request so the record starts clean. Every
      day from here on arrives through `/upload` as a photograph, which means the first
      upload is also the first time the reader has ever run against real paper. Watch that
      first one closely: whether the row grid lands on the right rows, and whether the
      close-up pass agrees with the whole-page read or argues with it on every row. The
      old transcriptions are still in `supabase/seed_september.sql` if they are ever
      wanted back.
- [ ] 2026-09-16 — The row grid behind the photo boxes has never been measured against a
      real photograph — no API key in a web session. Validation, fallback and the align
      handles are covered by `tests/geometry.test.js`, but how *often* the reader gets the
      grid right is unknown. Watch the first few photos: if the boxes usually need
      aligning, drop the model's grid and just use the even split plus handles.
- [ ] 2026-09-16 — Decide, once there are a few hundred training samples, whether a custom
      counter is worth training at all. If Claude plus `lib/tally.ts` is accurate enough that
      review is a glance, it isn't — the human confirmation step can't be removed from an IEP
      record regardless of model quality. Check the corrected-vs-total ratio in Settings.
- [ ] 2026-09-22 — Verify the vision parser against a real photo end-to-end once
      `ANTHROPIC_API_KEY` is set. There are no seeded rows to compare against any more, so
      the check is against the paper itself: count a couple of cells by hand and see
      whether the review screen agrees.
- [ ] 2026-09-16 — Still uncovered by tests: the session cookie round-trip in
      `lib/session.ts`, PIN hashing in `lib/pin.ts`, and the CSV shape. (Tally counting
      and filtering/aggregation are covered.)
- [ ] 2026-09-16 — The period × behavior heatmap needs horizontal scrolling at phone
      width with all 8 behavior columns showing. Filtering to fewer behaviors fixes it,
      but a scroll affordance (or a stacked layout on narrow screens) would be better.

## Done

- [x] 2026-09-22 — Cleared all five seeded September days from the live database (50 period
      rows cascaded; no photos or training samples existed). The app now starts empty, at
      the user's request. `supabase/seed_september.sql` keeps the transcriptions.

- [x] 2026-09-22 — Deployment is fully live and nothing about it is manual any more: the
      Vercel project `harper-behavior-log` exists, production tracks `main`, and
      `hc.stationinsight.com` is already aliased to the production deployment (confirmed
      against the deployment that shipped this session's merge).
- [x] 2026-09-22 — Reading accuracy: every row that carries a number is now read a second
      time from a close-up crop cut out of the full-resolution photo in the browser
      (`lib/image.ts` `cropRow`, `lib/rowread.ts`, `app/api/parse/rows/route.ts`). The
      close-up may lower a count or confirm it, never raise one, and the winning reading
      brings its own transcription so counts never stop matching marks
      (`lib/reconcile.ts`, `tests/reconcile.test.js`).
- [x] 2026-09-22 — "Checked against the paper" is stored and shown
      (`harper_daily_logs.verified_at`, migration `0005`). The report no longer claims
      every day was checked by a parent — it counts them. The dashboard names the
      unchecked days and links to them.
- [x] 2026-09-22 — 9/10's Specials row claimed both "couldn't observe this period" and 10
      incidents. Counts cleared, marks kept, day corrected from 66 to 56 live and in the
      seed.

- [x] 2026-09-16 — Training-set capture: every confirmed review and every later correction
      records the machine's reading beside the human's verdict, with the cell's box on the
      photo (`harper_training_samples`, `lib/samples.ts`, `lib/training.ts`). Settings shows
      the running count and exports JSON Lines. No image copies — crops are derived from the
      photo plus the stored box.

- [x] 2026-09-16 — Tappable boxes over each row of the photographed form: tap a box to edit
      that period's numbers. Grid measured by the reader as a validated ten-row band set
      (`lib/geometry.ts`, `components/PhotoBoxes.tsx`), falling back to an even split when
      it doesn't hold up, with two drag handles to align it by hand. Stored per photo in
      `harper_daily_logs.row_geometry`.

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
