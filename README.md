# Behavior Log

Photograph the daily paper behavior log that comes home from school; an AI reads the
handwritten tally marks; you check the numbers; the data lands in tables and charts and a
printable summary for the ARD meeting.

## How it works

1. **Unlock** — one shared 4-digit PIN, checked on the server. Success sets a signed,
   http-only cookie that lasts 30 days, so a phone stays unlocked.
2. **Photograph** — the browser shrinks the picture to 1568px on its longest edge before
   uploading, so a 5MB phone photo travels as ~400KB.
3. **Read** — Claude (vision) transcribes the page into structured JSON: per class period,
   how many of each numbered behavior, the teacher's notes, smiley faces, and whether the
   teacher could observe that period at all. It also transcribes the raw tally marks
   verbatim so a human can check its arithmetic.
4. **Review** — nothing is written to the database until you confirm. Rows the model was
   unsure about are outlined in amber. The date is required; the form's date box is often
   blank, so it defaults to today and asks you to set it.
5. **Charts, table, report** — rendered server-side. One query pulls every log; all
   aggregation happens in `lib/derive.ts`, which is what lets a single filter set scope
   the charts, the table, the report and the CSV identically.

## How the counting is kept honest

Reading handwritten tallies is the one place this app can quietly be wrong, and a
number that's too high is worse than useless in an IEP meeting. Four things guard it:

1. **The model transcribes; the code counts.** The vision model writes down the glyphs
   it can see in each cell (`raw_tally`, e.g. `1111 66666`). `lib/tally.ts` counts those
   characters in plain TypeScript. Where the model's own arithmetic disagrees with its
   transcription, the transcription wins and the row is flagged — the transcription is
   the part a person can check against the photo.
2. **Two independent reads.** Each photo is read twice. Cells where both reads agree
   pass through; cells where they disagree keep the **lower** count and are flagged for
   a human. Set `PARSER_PASSES=1` to fall back to a single read.
3. **Contradiction checks.** A period marked "the teacher couldn't observe this" cannot
   also carry counts; counts with no marks transcribed probably came from the prose
   notes rather than the page. Both are flagged rather than silently saved.
4. **A human confirms every number**, with the reason each flagged row was flagged
   printed next to it, before anything is written.

The prompt is explicit that padding a run is a serious error and that a cell full of
notes with no tally marks is correctly read as zero.

## Tappable boxes on the photo

The photo carries a box over each of the form's ten rows, labelled with the period and
the number currently recorded against it. Tap one and you land on that row's counters —
so a miscount is fixed while looking at the marks it came from, without hunting for the
matching row in a list. Rows whose numbers disagree with their transcribed marks are
drawn in amber.

The grid comes from the reader, and it can be wrong, so it is treated as a claim to be
checked rather than fact:

- **It's a row grid, not free-form boxes.** The form is a fixed ten-row printed table, so
  a row is fully described by a top and a bottom edge. Asking a vision model "where does
  this row start and end" is a one-dimensional question it answers far more reliably than
  "draw a rectangle", and the answer is cheap to check: ten rows, present, in schedule
  order, ascending, not overlapping.
- **A grid that fails that check is thrown away**, not repaired, in favour of an even
  ten-way split. A box over the wrong row is worse than an obviously approximate one,
  because it puts a confident-looking edit on the wrong period.
- **Two reads must agree.** Each photo is read twice; if the two place a row more than
  4% of the image apart, neither is trusted and it falls back.
- **It can always be fixed by hand.** "Line up the boxes" gives two handles — the top of
  the first row and the bottom of the last. Dragging them rescales every row in between
  proportionally, which is enough to align any grid on a flat photograph. The aligned
  grid is saved against that photo.

Coordinates are stored as fractions of the image, so they hold up at any size — thumbnail,
full screen, or zoomed.

## One day at a time

Tapping a day — in the table, in the day-by-day list, on a bar in the daily chart, or
on a page in the gallery — opens `/day/<date>`: the photographed page at the top, every
period underneath with the marks it was counted from, and the teacher's notes.

**Fix these numbers** turns that page into an editor, so a miscount is corrected in
place. The day keeps its id, its photo and its original machine reading, so the audit
trail behind the correction survives. Where the saved numbers no longer match the marks
transcribed off the page, the row says so and offers to re-count from the marks.

A day with no photo (the September logs were transcribed before the site existed) can
have the paper photographed and attached from that same page — nothing needs deleting
and re-entering.

## Filtering

Every view is scoped by the same filter row, and the filters live in the URL, so a
filtered view can be bookmarked or shared as a link. Four dimensions, combinable:

- **When** — all time, last 7 / 30 / 90 days, this month, or a custom from–to window
- **Behavior** — any subset of the eight numbered behaviors
- **Class / time of day** — any subset of the ten daily periods
- **Day of week** — Mon–Fri

An empty group means "all of it". Filtering by behavior narrows the counts but *not* the
number of school days, so a per-day average stays honest: "aggression only" across five
recorded days is 13 over 5 days, not 13 over the 3 days it happened on. A filtered report
prints a line saying exactly which slice it covers, so a PDF can never misrepresent itself
as the full record.

## The other pages

- **Add** — photograph the log, or pick an existing picture from the phone, or type it in
  by hand. Every route ends at the same review screen.
- **Pages** — the original photographs, as a gallery; each one opens its day. Days with
  no photo are listed so the paper can still be photographed. Private bucket, short-lived
  signed URLs.
- **Report** — lists its own six sections with a toggle for each, so you choose exactly
  what the printed PDF contains, including an appendix of the original log pages.
- **Settings** — change the shared PIN (stored hashed in the database, so no redeploy),
  lock the device, and see what the app has stored.

## The eight behaviors

The numbers on the paper form, which are the numbers everywhere in this app:

| # | Behavior |
|---|---|
| 1 | Interrupting |
| 2 | Shouting |
| 3 | Inappropriate usage of supplies / breaking materials |
| 4 | Throwing / kicking / hitting |
| 5 | Cutting papers / materials |
| 6 | Refusal / work refusal |
| 7 | Taking shoes & socks off & throwing them |
| 8 | Snacking |

The teacher writes repeated digits as tallies — `1111` means behavior 1 happened four
times — and the parser is built specifically around counting those glyphs, including the
stroke (`||||`) and cursive-loop styles the teacher also uses.

## Data

Everything lives in an existing Supabase project, namespaced with a `harper_` prefix:

- `harper_behaviors`, `harper_periods` — lookups
- `harper_daily_logs` — one row per school day (plus the raw model output, for audit, and
  `row_geometry`: where each form row sits on the photo, as image fractions)
- `harper_log_periods` — one row per class period per day, with `b1`…`b8` counts
- `harper_settings` — app settings a parent can change without a redeploy; currently the
  PIN, stored as a salted scrypt hash
- `harper_v_*` — SQL views over the same data, kept for ad-hoc queries in the Supabase
  dashboard. The app derives its own aggregates in TypeScript so filters apply uniformly;
  `npm test` cross-checks the two agree.
- `harper-logs` — a **private** storage bucket for the original photos

Row-level security is enabled with no policies, so the public API keys can read nothing.
All access goes through server-side route handlers using the service-role key.

Schema: `supabase/migrations/`. Seed data from the first five logs:
`supabase/seed_september.sql`.

## Environment variables

See `.env.example`. Four are required: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`APP_PIN`, `SESSION_SECRET`. `ANTHROPIC_API_KEY` is needed only for reading photos —
without it, everything else works and logs can be entered by hand.
`PARSER_PASSES` is optional (default 2) — how many independent reads to take of each photo.

## Changing the PIN

Use the **Settings** page in the app. It stores a hashed PIN in the database and takes
effect immediately for everyone.

`APP_PIN` in the environment is only the starting PIN — it's what the app falls back to
until someone changes it in Settings. Once a PIN has been set in the app, the env var is
ignored.

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in the two secrets
npm run dev
```

`npm run typecheck` and `npm test` both run without any secrets — the tests work off a
fixture extracted from the seed data, on plain node, with no test framework.

## A note on security

A 4-digit PIN is real protection against someone stumbling onto the URL, not against a
determined attacker. The site is `noindex`, the photos are in a private bucket served
through 60-second signed URLs, and failed PIN attempts are rate-limited — but the address
shouldn't be shared more widely than it needs to be.
