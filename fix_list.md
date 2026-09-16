# Fix list

Outstanding fixes, TODOs, and known issues for the behavior log.

Add new items at the top. Use the format:

- [ ] YYYY-MM-DD — short description (file_path:line if relevant)

## Open

- [ ] 2026-09-16 — Deploy: Vercel project must be imported by hand; the Claude↔Vercel
      connection returns 403 on project creation. Once the project exists, set the five
      env vars and attach `hc.stationinsight.com`.
- [ ] 2026-09-16 — Confirm the dates on the 9/9 and 9/10 logs (both forms came home with
      a blank date box; they're flagged `date_confirmed = false` and editable in /data).
- [ ] 2026-09-16 — Verify the vision parser against a real photo end-to-end once
      `ANTHROPIC_API_KEY` is set, and compare its counts to the seeded rows for that date.
- [ ] 2026-09-16 — The five seeded September logs have no stored photo (they were
      transcribed from images in a chat, not uploaded), so the Pages gallery and the
      report's photo appendix are empty until new logs are added by picture. Re-photograph
      them if the original pages are wanted as an audit trail.
- [ ] 2026-09-16 — Tests cover filtering/aggregation only (tests/derive.test.js). Still
      uncovered: tally parsing in `lib/parse.ts`, the session cookie round-trip in
      `lib/session.ts`, PIN hashing in `lib/pin.ts`, and the CSV shape.
- [ ] 2026-09-16 — The period × behavior heatmap needs horizontal scrolling at phone
      width with all 8 behavior columns showing. Filtering to fewer behaviors fixes it,
      but a scroll affordance (or a stacked layout on narrow screens) would be better.

## Done

- [x] 2026-09-16 — Filtering across every view (behavior, class period, day of week, date
      range), carried in the URL and applied identically to charts, table, report and CSV.
- [x] 2026-09-16 — A test suite exists: `npm test` runs `tests/derive.test.js` on plain
      node, checking the filter/aggregation math against the real seeded numbers.
