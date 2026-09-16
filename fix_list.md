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
- [ ] 2026-09-16 — No test suite yet. The SessionStart hook skips `npm test` until one
      exists. Worth covering: tally parsing normalization in `lib/parse.ts`, the
      session cookie sign/verify round-trip in `lib/session.ts`, and the CSV shape.
- [ ] 2026-09-16 — Verify the vision parser against a real photo end-to-end once
      `ANTHROPIC_API_KEY` is set, and compare its counts to the seeded rows for that date.
- [ ] 2026-09-16 — The five seeded September logs have no stored photo (they were
      transcribed from images in a chat, not uploaded). Re-photograph them if the
      original pages are wanted as an audit trail.

## Done

_(none yet)_
