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
4. **Read again, row by row** — each row that carries a number is cropped out of the
   full-resolution photo and read on its own, so counting the marks isn't competing with
   finding the rows. A close-up may lower a count, never raise one.
5. **Review** — nothing is written to the database until you confirm. Rows the model was
   unsure about are outlined in amber. The date is required; the form's date box is often
   blank, so it defaults to today and asks you to set it.
6. **Charts, table, report** — rendered server-side. One query pulls every log; all
   aggregation happens in `lib/derive.ts`, which is what lets a single filter set scope
   the charts, the table, the report and the CSV identically.

## How the counting is kept honest

Reading handwritten tallies is the one place this app can quietly be wrong, and a
number that's too high is worse than useless in an IEP meeting. Five things guard it:

1. **The model transcribes; the code counts.** The vision model writes down the glyphs
   it can see in each cell (`raw_tally`, e.g. `1111 66666`). `lib/tally.ts` counts those
   characters in plain TypeScript. Where the model's own arithmetic disagrees with its
   transcription, the transcription wins and the row is flagged — the transcription is
   the part a person can check against the photo.
2. **Two independent reads of the page.** Each photo is read twice. Cells where both
   reads agree pass through; cells where they disagree keep the **lower** count and are
   flagged for a human. Set `PARSER_PASSES=1` to fall back to a single read.
3. **Then every row again, close up.** See below — this is the pass that catches a run
   of seven read as eight.
4. **Contradiction checks.** A period marked "the teacher couldn't observe this" cannot
   also carry counts; counts with no marks transcribed probably came from the prose
   notes rather than the page. Both are flagged rather than silently saved.
5. **A human confirms every number**, with the reason each flagged row was flagged
   printed next to it, before anything is written.

The prompt is explicit that padding a run is a serious error and that a cell full of
notes with no tally marks is correctly read as zero.

### Reading each row close up

A whole page shrunk to 1568px on its long edge puts one row of the ten-row table at
about a hundred pixels tall. That is not enough to tell seven marks from eight, and it
is the same read that also has to find the rows and make sense of the notes. So once
the page has been read, every row that carries a number is read **again on its own**,
cropped out of the full-resolution photo in the browser and sent back as a single
question: how many glyphs are in this one cell?

Splitting the work that way is the point — nothing in the second pass has to decide
which row it is looking at. Two rules stop it becoming a new way to be wrong:

- **A close-up may lower a count or confirm it. It may never raise one.** A crop can
  catch the edge of the row above or below, so "the close-up saw more marks" is at
  least as likely to be a cropping error as a missed mark. When it reads higher, the
  lower number stands and the row is flagged.
- **Counts and marks always come from the same reading.** Whichever reading wins brings
  its transcription with it, so the stored numbers never stop matching the stored
  marks — that invariant is what lets a person check a number against the photo.

An empty close-up over a row the page said had marks is treated as a bad crop, not as
proof the marks aren't there: the page reading stands and the row is flagged. The pass
is skipped entirely when the row grid wasn't measured from the page, because cropping
from a guessed grid would hand the reader the wrong strip of paper. Anything that goes
wrong here costs that row its second look and nothing else — the reading the parent is
waiting for is already in hand. Covered by `tests/reconcile.test.js`.

## Assistance called, and removals from class

Two counts sit alongside the eight behaviors and are deliberately **not** part of them:

- **Assistance called** — another adult was brought into the room: support teacher, aide,
  administrator.
- **Removed from class** — Harper was taken out of the room as a consequence of behavior.
  A scheduled pull-out (therapy, the nurse, lunch, specials) is not a removal, and neither
  is her leaving on her own.

The eight numbered behaviors describe what the child did. These two describe what the
school had to do about it, which is the different question an ARD committee is actually
being asked to decide — "interrupting, nine times" is not a staffing case, and "assistance
was called four times in five days" is.

They are counted **once per day**, in their own box at the top of the day, because that is
how the paper records them. Per-class would mean asking someone to decide which period a
removal belonged to, and the form never says.

Three rules keep them honest:

1. **They are never added to any incident total.** The period total is generated from the
   eight behavior counts and stays that way, so every incident figure remains comparable
   with every figure recorded before these existed — and a removal is never counted as a
   second incident on top of the behavior that caused it. The report says so in as many
   words, and the day page says it under the box.
2. **Only the filters that pick whole days can narrow them.** The date range and the day of
   week do. The behavior filter cannot, because an assistance call is not a behavior and
   narrowing it would let a filtered report understate the support the classroom needed.
   Neither can the class-period filter: the counts belong to the day, so a view scoped to
   Writing still reports the whole day's figure, and the screen says so rather than
   implying otherwise. Asserted in `tests/support.test.js`.
3. **Every non-zero one is confirmed by a human, explicitly.** These come from the
   teacher's own count or her sentences, not from tally marks, so the reader proposes them
   and the review screen shows why next to the box. Where two reads disagree, the lower
   stands — the same rule the tallies follow.

   The box carries its own tick: *"These two numbers are right for this day."* When either
   count is above zero the tick is **required** — the save button says so and won't go
   until it's ticked. On a day with neither, it's optional, because a day with nothing to
   report has nothing to vouch for and demanding a tick on every quiet day would only
   teach people to tick without looking.

   That tick is stored as `support_confirmed_at`, separate from `verified_at`. The latter
   says someone checked the whole day against the page; this one says someone specifically
   stood behind these two figures — worth distinguishing, since they're the numbers a
   staffing argument would quote. It is never set on the reviewer's behalf: saving a log
   is not by itself a statement about them. The day page and the printed report both say
   which days were confirmed.

On the dashboard and in the report they get their own chart: grouped bars per school day,
one pair per day, with the numbers table underneath. It is a **separate plot** from the
incidents chart rather than a second line on it — these run in single figures where
incidents run to dozens, and no chart here carries two y-axes.

They take no slot in the eight-colour behavior palette; that palette's slot order is its
colorblind-safety mechanism and its slots belong to the behaviors. Instead they use violet
and red from the same validated ramp as a pair of their own, checked against both chart
surfaces before use (colour-vision separation ΔE 22.7 light and 19.5 dark, against a floor
of 8). Each mode gets its own step, defined in `app/globals.css` as `--support-assistance`
and `--support-removed`. Identity never rests on hue alone: a legend is always present,
each bar carries its own number while the columns are wide enough, and the two series keep
a fixed left/right position within every day.

Where a stretch gets long enough that the day columns are narrower than a date label, all
three day charts print every second, third or twelfth date instead of smearing them
together — anchored to the most recent day, so the newest column is always labelled.

## Checked against the paper, or not

Every number in this app starts as a transcription. Until someone holds a day up
against the original page, it is a claim about that page rather than a record of it —
and a summary that cannot tell those two apart is weaker evidence than one that can.

So `harper_daily_logs.verified_at` records when a human last confirmed a day, and the
app says so everywhere: a badge on the table, a banner on the day page, a panel on the
dashboard linking straight to the days that need checking, and a line in the printed
report stating how many of the days it covers have been checked. A day is verified when
it is saved from the review screen, when its numbers are corrected, or when someone
presses **I've checked these against the paper** on its page.

The five September logs were transcribed from photographs that were never kept, so they
start unverified — which is the truth about them.

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

## Teaching the reader

Every confirmed log records, per row, what the reader thought the marks said next to what
a human agreed they were. That pairing is the one thing no public handwriting corpus
contains: MNIST and IAM teach *which character is this*, and the open questions on this
form are *how many of them are there* and *what does this teacher's shorthand mean*. Only
these pages answer those.

It costs nothing to collect and cannot be added later — the photos alone don't record
where a human disagreed. Whether it is ever worth training on is a decision for when
there's enough of it to tell; Settings shows the running count and downloads the set as
JSON Lines.

No cropped images are stored. A crop is fully determined by the photo, the row grid and
the period, all of which are already saved, so crops are cut on demand at whatever
resolution a training run wants — and they improve retroactively when a grid is realigned.
The box recorded on each sample is frozen at confirm time, so a later realignment can't
silently change what an existing label refers to.

Nothing leaves the app: the samples sit in the same locked-down project as everything else,
and the export is behind the same PIN.

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

Two more things are tracked **per day** but are **not** behaviors and are never added to an
incident total: `assistance_count` (another adult called into the room) and `removed_count`
(taken out of the classroom). See above.

The teacher writes repeated digits as tallies — `1111` means behavior 1 happened four
times — and the parser is built specifically around counting those glyphs, including the
stroke (`||||`) and cursive-loop styles the teacher also uses.

## Data

Everything lives in an existing Supabase project, namespaced with a `harper_` prefix:

- `harper_behaviors`, `harper_periods` — lookups
- `harper_daily_logs` — one row per school day (plus the raw model output, for audit,
  `row_geometry`: where each form row sits on the photo, as image fractions, and
  `verified_at`: when a human last checked the day against the original page, and
  `assistance_count` / `removed_count`: the day's two support counts, which are not
  behaviors and never part of an incident total, plus `support_confirmed_at`: when a human
  ticked those two as correct)
- `harper_log_periods` — one row per class period per day, with `b1`…`b8` counts
- `harper_settings` — app settings a parent can change without a redeploy; currently the
  PIN, stored as a salted scrypt hash
- `harper_training_samples` — append-only: one row per period per confirmed review, holding
  the machine's reading, the human's verdict, and where on the photo the cell sits
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
`PARSER_PASSES` is optional (default 2) — how many independent whole-page reads to take
of each photo. The per-row close-up pass runs on top of that and is not configurable.

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
