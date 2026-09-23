# CLAUDE.md

Project-specific instructions for Claude Code when working on this repository.

## What this is

A phone-first web app for tracking a child's daily school behavior log. A parent or
teacher photographs the paper form; Claude vision reads the handwritten tally marks; a
human confirms every number; the data feeds tables, charts, and a printable summary used
as evidence in ARD/IEP meetings. See README.md for the product and architecture detail.

Stack: Next.js (App Router) on Vercel, Supabase Postgres + private Storage, Anthropic
Messages API for the handwriting. All database access is server-side with the service-role
key; row-level security is on with no policies, so the public keys can read nothing.

## Branch model

- `main` is the **live production branch** — Vercel auto-deploys every push.
- Claude Code sessions work on a per-session branch (e.g. `claude/session-<slug>`).
- Session branches are **drafts**. They never deploy. They only affect production after the end-session protocol below merges them into `main`.
- Treat `main` as the source of truth at the start of every session — never carry stale branch state forward.

## Start-session protocol (run on EVERY new session)

**Hard rule:** every new session MUST begin with the working branch at
`origin/main` HEAD. No session may start from a stale branch, a forked
commit, or anything other than the most recent `origin/main`. This is
non-negotiable — it prevents the "I never saw that feature" problem
where the session forks off an old commit and ships duplicates or
regressions of work already on main.

The SessionStart hook enforces this automatically. If it can't (dirty
tree, branch ahead of main on resume, fetch failure, etc.), the
assistant **must stop and surface the drift to the user before doing
any other work** — see "Turn-1 verification" below.

### Web sessions (Claude Code on the web): AUTOMATED

A SessionStart hook (`.claude/hooks/session-start.sh`, registered in
`.claude/settings.json`) runs automatically and:

1. Injects the "read CLAUDE.md / README.md / fix_list.md first" policy into
   the session's `additionalContext`. Auto-creates a stub `fix_list.md` if
   missing (never overwrites).
2. Syncs the working branch to `origin/main` (fetch + `git reset --hard`)
   per the policy below:
   - **`source=startup`**: always reset to `origin/main`, even if the
     branch is ahead. Fresh sessions never inherit forked state — any
     ahead commits remain in `git reflog <branch>` if needed.
   - **`source=resume`/`compact`/`clear`**: only auto-syncs when it's a
     pure fast-forward (no commits ahead of `origin/main`). If the
     branch has session-in-progress commits ahead, the hook emits a
     **BLOCKER** instead of destroying that work, and the assistant
     must surface the drift to the user.
   - **Skipped (BLOCKER emitted)** when: on `main` itself, dirty
     working tree, detached HEAD, or `git fetch` fails. In each case
     the assistant must stop and resolve before any other work.
3. Runs `npm install`, `npm run typecheck`, and `npm test` so the assistant
   has a known-good baseline before turn 1. Checks whose npm script does not
   exist yet are reported as skipped rather than failed.
4. Extracts the most recent `## Session log` entry from CLAUDE.md so the
   assistant sees what the previous session shipped.
5. Emits a single summary (policy + sync status + check results + previous
   session entry) into `additionalContext`. When sync was blocked, the
   payload begins with `⛔ SESSION-START BLOCKER`.

### Local sessions (or web fallback): MANUAL

If you're working locally, or the hook didn't run for any reason, do the
same steps by hand BEFORE any other work:

1. `git fetch origin --prune`
2. `git checkout <working-branch>` (create from `origin/main` if it doesn't
   exist yet — **never create a branch from an older commit**)
3. Get to `origin/main` HEAD:
   - If the branch has no commits ahead of `origin/main`:
     `git reset --hard origin/main` (or `git merge --ff-only origin/main`).
   - If it has session work ahead and you want to keep it:
     `git merge --no-ff origin/main` and resolve conflicts.
   - If the ahead commits are stale and unwanted:
     `git reset --hard origin/main` (verify reflog has a backup first).
4. Run `npm install`, `npm run typecheck`, and `npm run build` to confirm the
   baseline is healthy. Fix anything broken before adding new work.

### Turn-1 verification (assistant MUST perform on every session)

Even with the hook in place, on the first turn of every session the
assistant verifies the branch is at `origin/main` HEAD before doing any
real work:

1. Read the `additionalContext` injected by the SessionStart hook. If it
   begins with `⛔ SESSION-START BLOCKER`, **stop immediately**, relay the
   sync status to the user, and ask how to proceed (commit/stash, merge
   origin/main in, or hard reset). Do not start the task.
2. If no hook context is present (local session, hook crashed, etc.),
   manually run:
   ```
   git fetch origin --prune
   git rev-list --count HEAD..origin/main   # commits behind main
   git rev-list --count origin/main..HEAD   # commits ahead of main
   git status --porcelain                   # dirty tree?
   ```
   If behind > 0, ahead > 0, or dirty: stop and surface to the user. Only
   proceed once the branch is at `origin/main` HEAD (or the user has
   explicitly directed otherwise for this session).
3. Only after the branch state is confirmed at `origin/main` HEAD may the
   assistant begin the user's task.

This is the safety net that catches everything the hook can't auto-fix.

## End-session protocol (run on EVERY "end session")

When the user types **"end session"** (or a clear equivalent — "wrap up",
"merge this", "ship it", etc.), the goal is to land everything on `main`.
**This is non-negotiable** — every session must end with the working
branch merged into `main` and pushed. Do the following in order:

1. **Commit any uncommitted work** on the working branch first, with a
   descriptive message. No exceptions — no "I'll get to it later" stashes.

2. **Update the `## Session log` section** of this file with a dated entry
   summarizing every meaningful change made during the session:
   ```
   ### YYYY-MM-DD — <branch name>
   - bullet for each meaningful change
   - group by feature / fix / docs where it helps
   - reference key files added/modified when useful
   ```
   Append newest-first.

3. **Commit the CLAUDE.md update** to the working branch with a message
   like `Update CLAUDE.md with session log`.

4. **Push the working branch** to origin so it's safe before the merge:
   `git push -u origin <working-branch>`.

5. **Merge the working branch into `main`**:
   - `git fetch origin --prune`
   - `git checkout main`
   - `git pull --ff-only origin main`
   - `git merge --no-ff <working-branch>` (preserve history with a merge
     commit; the merge commit message should be
     `Merge <working-branch> into main — <one-line summary>`)
   - Resolve any conflicts thoughtfully — keep both sides where they don't
     actually overlap. If a conflict is genuinely ambiguous, **stop and
     surface it to the user** before continuing.
   - Run `npm run typecheck` and `npm run build` on `main` after the merge
     to confirm nothing broke (plus `npm test` once a suite exists). Fix
     anything that did.
   - `git push origin main`

6. **Switch back to the working branch** so the user can keep iterating if
   they want: `git checkout <working-branch>`.

7. **Confirm to the user** with the merged commit hash and a one-sentence
   summary of what landed.

**Rules:**
- Do **not** delete the working branch after merge — keep it for reference.
- Do **not** skip the merge to main, even if the session was "just a quick
  fix". A branch that never merges turns into the "lost session" problem.
- Do **not** force-push to main. If main has new commits while you were
  working, pull them in (step 5's `git pull --ff-only`) and re-attempt the
  merge.
- If the user explicitly says "don't merge yet" (e.g. they want to open a
  PR for review), respect that — but still commit + push the working
  branch + update the session log + remind them the merge is pending.

## Project-specific notes

- **Database lives in someone else's project.** The tables sit inside the
  existing Supabase project `puzwcsrtqtbutypzozvu` ("Where's my note"), so every
  table, view and bucket is prefixed `harper_` / `harper-`. Never create an
  unprefixed object there, and never touch that project's other tables.
- **Schema changes** go in `supabase/migrations/` as a new numbered file AND are
  applied to the live project. Keep the two in sync.
- **Secrets** (`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`) are set in
  Vercel's environment variables only. They are not in the repo and are not
  available in web sessions — code that needs them must fail with a clear,
  user-facing message rather than a stack trace.
- **The behavior numbers 1–8 are the teacher's, not ours.** They appear on the
  paper form, so they must stay stable everywhere: `lib/behaviors.ts` is the one
  place they are defined.
- **Chart colors** come from a CVD-validated categorical palette; the slot order
  is the colorblind-safety mechanism. Don't re-order or extend it casually.

## Session log

### 2026-09-23 — claude/nice-allen-bet182 (charting the two support counts, and a tick for them)

Two asks, both about the assistance-called and removed-from-class figures added the day
before: put them on the graphs, then let a person confirm them.

**The chart**
- `SupportPerDayChart` + `SupportLegend` in `components/charts.tsx`: grouped bars per school
  day, on the dashboard and in the report, with the numbers table kept underneath as the
  table view.
- Its **own plot**, not a second series on the incidents chart. These run in single figures
  where incidents run to dozens: a shared axis flattens them to nothing, and a twin axis
  invites comparing two unrelated units. Same width and side margins as `TotalPerDayChart`
  so the day columns line up down the page.
- Colour: they take no slot in the eight-colour behavior palette — that palette's slot
  order is its colorblind-safety mechanism and its slots belong to the behaviors. They use
  violet and red from the same validated ramp as a pair of their own, **run through the
  palette validator against this app's real surfaces before use**: CVD separation dE 22.7
  light and 19.5 dark against a floor of 8, every check passing in both modes. Hexes live
  in `app/globals.css` as `--support-assistance` / `--support-removed` so each mode gets
  its own step instead of a light hue on a near-black surface.
- Identity never rests on hue alone: legend always present, every bar labelled with its own
  number while columns are wide enough, fixed left/right position per series.

**A defect that only a render caught**
- Compiled the component, server-rendered it with sample data at 8 / 22 / 40 / 180 days and
  screenshotted it. Past about twenty days the date labels collided into a smear — and the
  flaw was already in `TotalPerDayChart` and `StackedByBehaviorChart` too.
- All three day charts now print every Nth date, anchored to the LAST day so the most recent
  column is always labelled (`labelStride` / `labelled`). The per-bar numbers drop out once
  a column is too narrow to hold them, where the legend and fixed position still carry
  identity. Re-rendered and re-checked at every density.

**The confirmation tick**
- `supabase/migrations/0008_harper_support_confirmed.sql` (applied live):
  `support_confirmed_at` on `harper_daily_logs`.
- Why its own column rather than leaning on `verified_at`: that one says the whole day was
  checked against the page; this is the narrower claim that someone stood behind these two
  figures specifically. They are the only numbers in the app read out of the teacher's
  sentences rather than counted off her marks, and the ones a staffing argument would quote.
- **Required when either count is above zero** — the save button says so and refuses, and
  the box outlines in amber. **Optional on a quiet day**, because a day with nothing to
  report has nothing to vouch for and demanding a tick every time would only teach people
  to tick without looking.
- Never set on the reviewer's behalf: saving a log is not by itself a statement about these.
- Shown on the day page, flagged on the dashboard card, and counted in the report, which now
  says how many of the days that reported an event had them confirmed rather than implying
  all of them did.
- Rendered the box and checked all four states before committing.

**Tests**
- `tests/support.test.js` grew to cover the confirmation: that it rides with the day, that a
  missing column reads as unconfirmed, that reporting an event without ticking stays
  unconfirmed, and that it is not the same field as `verified`.

**Still open**
- None of this has met a real photograph yet. See `fix_list.md`.

### 2026-09-22 — claude/nice-allen-bet182 (assistance and removals moved to per day)

Follow-up in the same session: the two counts belong in one box at the top of each day,
not on every class period.

- `supabase/migrations/0007_harper_support_per_day.sql` (applied live) moves
  `assistance_count` and `removed_count` onto `harper_daily_logs` and drops them from
  `harper_log_periods`. No data moved — there is none. 0006 is kept as history with a
  header pointing here, because the live database ran it and replaying the files must too.
- Per-period was the wrong model: it would have made someone decide which class a removal
  "belonged" to, and the paper never says. One box per day matches the form.
- The reader now reads them once for the whole page, and is told to trust a printed box at
  the top of the form over its own reading of the notes if one exists. Lower of the two
  reads still wins, and a non-zero value still lands in front of a human — the flag now
  sits on the box in `ReviewForm` (`ParsedLog.support_flags`) instead of on a row.
- One `SupportCounters` box now, at the top of the review screen and on the day page (read
  as two figures, editable under "Fix these numbers"). `PATCH /api/logs/[id]` takes a
  `support` object; `POST /api/logs` takes the two at the top level.
- The filter rule got sharper and is the thing to remember: neither the behavior filter NOR
  the class-period filter narrows these, because they belong to the day. Only the date
  window and the day of week do. A class-scoped view says so on screen rather than implying
  the number is that class's. `tests/support.test.js` rewritten around it (28 checks).
- Dashboard and report tables are per day now, with a total row; CSV carries them as
  `day_assistance_called` / `day_removed_from_class`, prefixed so nobody sums a repeated
  day attribute ten times.

### 2026-09-22 — claude/nice-allen-bet182 (assistance called, removals from class)

Asked for a tracker of two things the eight behaviors can't express: how many times
assistance was called, and how many times Harper was removed from class.

**Where they live, and why not as behaviors 9 and 10**
- `supabase/migrations/0006_harper_support_events.sql` (applied live): `assistance_count`
  and `removed_count` on `harper_log_periods`, per period, defaulting to 0.
- They are NOT new behavior codes. The numbers 1-8 are the teacher's, printed on the paper,
  and nothing may be added to them. They are also a different kind of fact: a behavior is
  what the child did, these are what the school had to do about it — which is the question
  an ARD committee is actually deciding.
- They are NOT part of the generated `total`. Every incident figure stays comparable with
  everything recorded before today, and a removal is never counted as a second incident on
  top of the behavior that caused it. The report states this in as many words.
- `SUPPORT_EVENTS` in `lib/behaviors.ts` is the one definition, next to `BEHAVIORS`.
- No palette slot assigned: the categorical palette's slot order is the colorblind-safety
  mechanism, so these are neutral ink told apart by fill vs outline.

**The filter rule worth remembering**
- The behavior filter does NOT narrow them, because they aren't behaviors. "Aggression
  only" narrowing assistance calls would let a filtered report understate the support the
  classroom needed. Date, weekday and class-period filters do apply. That asymmetry is the
  bulk of `tests/support.test.js` (28 checks, own fixture so the real September fixture
  keeps cross-checking against the view SQL).

**Reading them off the page**
- Unlike tallies these are written in prose, so `lib/parse.ts` gained a prompt section with
  a deliberately high bar: an explicit statement in that row's notes. Redirects, reminders
  and negotiation are not assistance; scheduled pull-outs (therapy, nurse, lunch, specials)
  and Harper leaving on her own are not removals; ambiguity takes the lower number.
- Every non-zero value is flagged on the review screen with the teacher's wording beside
  it, and where two reads disagree the lower stands — same rule the tallies follow.
- They deliberately survive `not_observed`: a removal from specials is still a removal, and
  the notes are what recorded it. The flag says so rather than clearing or silently keeping.

**Where they show up**
- `components/SupportCounters.tsx` (new): the two steppers, used by `ReviewForm` and by
  `DayDetail`'s editor, plus `SupportChips` for the read-only view.
- Day page totals, the day-by-day cards in `LogTable`, two dashboard stat tiles and a
  per-class table, a new report section ("Assistance called, and removals from class") with
  its own toggle, and two CSV columns placed after `period_total` rather than inside it.

**Not done**
- Nothing here has met a real photograph. See `fix_list.md` for the three open items,
  including that the training samples don't yet record corrections to these two counts.

### 2026-09-22 — claude/nice-allen-bet182 (counting accuracy, second pass; checked-or-not)

Opened on the same complaint as the previous session — "the 9/10 count is too high" — plus
"there needs to be a way to click on the day and see the details and the photo". The day
pages already existed and production was already running them, so the honest read of *try
again* was: the number itself was never fixed, no day has a photo, so clicking a day can
never show one, and the reader still counts from a single whole-page image.

**The 9/10 number, fixed**
- Its Specials row carried `not_observed = true` AND 10 tally marks. The two cannot both be
  true, and the app has refused that combination at review time since the counting rewrite
  — this row predates the rule. Counts cleared, `raw_tally` deliberately kept, day corrected
  **66 → 56**, live and in `seed_september.sql`. `supabase/migrations/0005` carries the same
  fix so a fresh database lands in the same place.
- The counts were cleared rather than the flag because an IEP record must never overstate: a
  period nobody could watch cannot supply evidence of behavior. Keeping the marks means one
  tap on "use the count from the marks" puts them back if the paper says otherwise.
- The remaining 9/10 runs (`11111111`, `6666666`) were left alone. Guessing at them is
  exactly the error being fixed. They need the page — see `fix_list.md`.

**Reading each row close up — the session's main piece**
- The real cause of a miscount: a page shrunk to 1568px puts a row of the ten-row table at
  about 116 pixels tall, and that same read also has to find the rows and parse the notes.
- So there is now a second pass. `lib/image.ts` keeps a larger in-memory copy of the photo
  (`DETAIL_EDGE`, never uploaded) and `cropRow` cuts a row out of it by image fractions;
  `app/api/parse/rows` reads each crop through `lib/rowread.ts`, which asks one question
  about one cell. Splitting transcription from row-finding is the point.
- `lib/reconcile.ts` holds the rules, and they are mostly limits: a close-up may **lower a
  count or confirm it, never raise one** (a crop can catch the row above, and over-reporting
  is the error that costs something); the winning reading brings its own transcription, so
  counts never stop matching marks; an empty close-up over a row the page said had marks is
  treated as a bad crop, not as proof, and flags rather than zeroing.
- Skipped when the grid wasn't measured from the page — cropping from a guessed grid hands
  the reader the wrong strip of paper. A failure costs that row its second look and nothing
  else; the review the parent is waiting for is already in hand.
- `tests/reconcile.test.js`: 38 checks, most asserting what the close-up is *not* allowed to
  do, including the four real 9/10 cells.

**Checked against the paper, or not**
- `migrations/0005_harper_verification.sql` (applied live): `verified_at`, `verified_note` on
  `harper_daily_logs`. Null for all five September days, which is the truth about them.
- The report used to print "Each day was transcribed from the original page and checked by a
  parent against the photograph before being entered." That was false for every day in the
  database. It now counts them and says which.
- Shown on the day page (banner + "I've checked these against the paper"), the table, and a
  dashboard panel that links straight to the unchecked days. A day verifies on save from the
  review screen, on correction, or on that button.

**Also**
- Closed the long-standing "deployment is manual" item. The Vercel project exists,
  production tracks `main`, and `hc.stationinsight.com` is aliased to it — all confirmed
  against the deployment that shipped this merge, not assumed.

**Then: cleared the database**
- Asked mid-session to delete the five uploaded days and start fresh. Done on the live
  project: 5 days, 50 period rows cascaded, no photos and no training samples existed, and
  the `harper-logs` bucket was already empty. `harper_settings` and `harper_pin_attempts`
  were left alone.
- `supabase/seed_september.sql` still holds those transcriptions, so the delete is
  reversible — but they were never checked against paper, which is why starting clean is
  the better record. Every day from here arrives as a photograph, which also means the
  first upload is the first time the reader runs against real handwriting.

**Still open**
- Nothing here has run against a real photograph — no API key in a web session. The close-up
  pass typechecks, builds, and its rules are tested on plain node; its hit rate is unknown.
- The five September pages still need photographing. That is now the only thing between this
  app and a record where every number has been checked.

<!-- newest first; append a new dated entry on every "end session" -->

### 2026-09-16 — claude/beautiful-shannon-46kla5 (training-set capture)

Came out of a question: is there public handwriting data to pre-train on? Short answer,
no — MNIST/EMNIST teach isolated digit identity, IAM teaches cursive words, and neither
answers this form's actual questions ("how many glyphs in this run" and "what does
`lolololo` mean"). The data that would answer them is the data this app already produces
every time a human confirms a reading, so it is now kept.

**What's collected**
- `supabase/migrations/0004_harper_training_samples.sql` (applied live): append-only, one
  row per period per confirmed review — the machine's `raw_tally`, counts and confidence,
  the human's counts, a `corrected` flag, and the cell's box on the photo. RLS on, no
  policies, same posture as every other table.
- **No cropped images are stored.** A crop is fully determined by (photo, row grid,
  period), all already saved — so crops are cut on demand at any resolution and improve
  retroactively when a grid is realigned. The box on a sample is frozen at confirm time so
  a later realignment can't change what an existing label points at.
- Captured on both paths: `POST /api/logs` compares the reader's untouched periods
  (`model_periods`, sent by `ReviewForm`) against the saved ones; `PATCH /api/logs/[id]`
  reads the day before overwriting it and pairs that with the correction. A log typed in
  by hand records nothing — there was no reading to disagree with.
- `recordSamples` swallows its own failures on purpose: this is bookkeeping for a
  maybe-someday model, and a parent saving a school day must never see an error from it.

**Getting it out**
- `GET /api/training` streams JSON Lines (`?corrected=1` for just the disagreements),
  behind the same PIN as everything else. Nothing leaves the app otherwise.
- Settings grew a "Teaching the reader" panel: rows collected, how many were corrections,
  how many link to a photo, days covered, and the download links.

**Structure**
- `lib/samples.ts` (new, pure) holds the part that decides what a label means;
  `lib/training.ts` keeps the database half. The split exists so `npm test` can exercise
  the labelling on plain node.
- `tests/samples.test.js`: 26 checks, focused on the `corrected` flag — including the case
  that matters most, the same total recorded under a different behavior.

**Judgement recorded**
- This may never be worth training on. If Claude plus `lib/tally.ts` reaches the point
  where review is a glance, a custom model saves nothing, because human confirmation can't
  be removed from an IEP record at any model quality. Collecting is free; training is not.
  Revisit at a few hundred samples — see `fix_list.md`.

### 2026-09-16 — claude/beautiful-shannon-46kla5 (tappable boxes on the photo)

Same branch, continuing from the counting-accuracy session. One feature: boxes drawn over
each row of the photographed form, tappable to edit that row.

**The design decision that matters**
- Free-form bounding boxes from a vision model are not reliable enough for this — a box
  over the wrong row invites a confident edit to the wrong period, which is worse than no
  box. So the model is asked for a ROW GRID instead: the form is a fixed ten-row printed
  table, so each row is just a top and a bottom edge. That is one-dimensional, far more
  reliable, and cheap to validate.
- `lib/geometry.ts` (new): `normalizeLayout` REJECTS rather than repairs — ten rows must
  all be present, in schedule order, ascending, non-overlapping, within the image, with a
  plausible table width. Anything else falls back to an even ten-way split.
- Two reads must also agree: `layoutDrift` over 4% of image height falls back. Agreeing
  grids are averaged.
- `rescaleBands` powers two drag handles (top of the first row, bottom of the last), which
  rescale every row proportionally — enough to fix any grid on a flat photograph.
- Coordinates are image fractions throughout, so they survive resize, thumbnail and zoom.

**Plumbing**
- `lib/parse.ts`: `row_top`/`row_bottom` per period and `table_left`/`table_right` on the
  tool schema, with prompt guidance to measure the printed ruled lines rather than the
  handwriting (handwriting spills across rows). `ParsedLog` carries `layout` plus
  `layout_source: "measured" | "estimated"`.
- `supabase/migrations/0003_harper_row_geometry.sql` (applied live): `row_geometry jsonb`
  on `harper_daily_logs`. `POST /api/logs` stores it only if it validates; `PATCH` accepts
  an aligned grid, so aligning is saved against the photo rather than the visit.
- `components/PhotoBoxes.tsx` (new): the overlay. Labels each box with its period and
  current total, amber where the numbers disagree with the marks, and carries the align
  mode. Used by `ReviewForm` (over the local preview, before saving) and `DayDetail` (over
  the stored photo; tapping opens the editor on that row).

**Tests**
- `tests/geometry.test.js`: 29 checks, most of them asserting that a questionable grid is
  rejected — rows running up the page, a missing row, a zero-height row, one off the page
  edge, an unknown row name, a sliver-wide table.

**Unverified**
- How often the reader actually gets the grid right is unknown; no API key is available in
  a web session, so this has never run against a real photograph. It degrades safely (bad
  grid → even split → two drags), but the hit rate is worth watching. See `fix_list.md`.

### 2026-09-16 — claude/beautiful-shannon-46kla5 (counting accuracy, day pages)

Opened on a real complaint: the 9/10 log reads 66 incidents, more than the paper says.

**Counting accuracy — the session's main piece**
- `lib/tally.ts` (new): counts tally glyphs deterministically. The vision model's two
  jobs — transcribe and count — are now split, and it only does the first. It writes the
  glyphs it can see into `raw_tally`; TypeScript counts the characters. Where the model's
  own `counts` disagree with its own transcription, the transcription wins and the row is
  flagged. Handles repeated digits, stroke runs (`||||`), cursive loop chains (`lelele`)
  and S-runs; a run of `l`s is strokes, not loops, which is a wrong-behavior bug avoided.
- `lib/parse.ts`: each photo is read **twice** independently (`PARSER_PASSES`, default 2).
  Agreeing cells pass; disagreeing cells keep the **lower** count and are flagged — an IEP
  record should never overstate. A failed second read degrades to one read plus a flag
  rather than failing the upload.
- Contradiction checks: `not_observed` with counts (which is exactly what the seeded 9/10
  Specials row does) clears the counts and flags; counts with no marks transcribed flags,
  because those numbers probably came from the prose notes.
- Prompt rewritten around the actual failure mode. It now states that the transcription is
  the answer and the arithmetic isn't the model's to do, that padding a run is a serious
  error, that runs over ~8 should be re-counted, that notes without marks correctly read as
  zero, and that marking a row uncertain costs nothing because a human checks it anyway.
- `PeriodEntry.flags` (review-time only, never stored) carries the reason to the UI;
  `ReviewForm` prints it per row and counts the flagged rows at the top.

**Day pages**
- `app/day/[date]/page.tsx` + `components/DayDetail.tsx` (new): one day in full — the
  photographed page (tap to zoom), every period with the marks it was counted from, notes,
  and **Fix these numbers**, an in-place editor. Rows whose stored numbers no longer match
  their transcribed marks are outlined with a one-tap "use the count from the marks".
- Reachable from the table dates, the day-by-day list, a bar on the daily chart, and the
  Pages gallery. `LogTable`'s accordion became linked cards; its fix-date and delete moved
  to the day page, which made `LogTable` a server component again.
- `PATCH /api/logs/[id]` now accepts period corrections (in place, so the day keeps its id,
  photo and original `raw_parse`); a hand-checked row is stored at `confidence: 'high'`.
- `POST /api/logs/[id]/photo` (new): attach or replace the photo on an existing day. The
  five September logs have no picture, so their numbers couldn't be checked against
  anything — now the paper can be photographed without re-entering the day. The Pages tab
  lists the days still missing one.

**The bug that meant photos never worked at all**
- Reading any photo failed with `400 ... 'minItems' values other than 0 or 1 are not
  supported`. A strict tool schema accepts only a subset of JSON Schema, and `periods`
  declared `minItems: 10, maxItems: 10`. Removed (the ten-row requirement is stated in the
  description, and a skipped row was already backfilled as an empty flagged period). A
  schema rejection now retries the read without `strict` instead of failing the upload, and
  API errors reach the user in plain language rather than raw JSON.
- The teacher also writes the 6-chain as `lolololo`, which the counter didn't recognise —
  visible in the 9/9 Reading cell (`III SSS 2222 lolololo`), where the stored 7 sixes should
  be 4. Both spellings are covered now and asserted in the tests.

**Tests**
- `tests/tally.test.js`: 41 checks over the counter, including the three real 9/10 cells.
  `npm test` runs it after `tests/derive.test.js`; still plain node, no framework.

**Not done — needs the paper**
- The 9/10 numbers themselves were left alone. Without the original page there's no way to
  tell a correct 8 from an inflated one, and guessing at an IEP record is worse than the
  bug. The tools to fix it in under a minute are in place; see `fix_list.md`.

### 2026-09-16 — claude/gallant-babbage-eseube (filtering, settings, photos)

Second session on the same branch. Everything below is additive; nothing from the
first session was removed except four now-unused query helpers.

**Filtering — the session's main piece**
- `lib/filters.ts` + `lib/derive.ts`: one filter set (date range, behavior type, class
  period, day of week) carried in the URL and applied identically to the charts, the
  table, the report and the CSV. Empty group means "all of it".
- Pages now call `getLogs()` once and aggregate in TypeScript rather than reading the
  four `harper_v_*` views; that single source is what makes the filters uniform. The
  views remain in the database for ad-hoc SQL, and `npm test` checks the two agree.
- Filtering by behavior narrows counts but NOT the recorded-day count, so per-day
  averages stay honest. `components/FilterBar.tsx` wraps the content it scopes and dims
  it during the server round-trip; filters follow you between tabs via `Nav`.

**Report**
- `lib/report.ts` + `components/ReportOptions.tsx`: the report lists its six sections
  with a toggle each, so the printed PDF contains exactly what was picked. Selection
  rides in the URL next to the filters.
- New appendix section showing the photographed original pages.
- A filtered report prints a line naming the slice, so a PDF cannot pass itself off as
  the complete record.

**Charts**
- `TotalPerDayChart` now prints each day's total under its date (replacing the two
  selective in-plot labels) — total incidents up the side, school days along the bottom.
- Stacked chart, legend, heatmap and `LogTable` all take a behavior subset.

**Settings and the PIN**
- `supabase/migrations/0002_harper_settings.sql` (applied live): `harper_settings`, RLS
  on with no policies. `lib/pin.ts` stores the PIN as a salted scrypt hash, so it can be
  changed from `/settings` instead of by redeploying. `APP_PIN` is now only the starting
  value, used until a PIN is set in the UI; changing it requires the current PIN.
- `/api/lock` + `LockButton` clear the session cookie. Settings also reports what is
  stored and whether photo reading is configured.

**Photos**
- New `/photos` gallery of the original log pages, served through short-lived signed URLs
  from the private bucket (`lib/photos.ts`).
- `UploadFlow` offers "pick an existing picture" alongside the camera. The previous
  capture-only input meant a phone could not choose from its library — that was a real
  bug, not a missing nicety.
- Nav is five tabs now; Settings sits behind a gear in `PageHeader`.

**Tests**
- `npm test` runs `tests/derive.test.js` on plain node — no framework, no secrets, 26
  checks over a fixture extracted from `seed_september.sql`. The unfiltered expectations
  are the numbers the SQL views return, so a run cross-checks the TypeScript aggregation
  against the database's own view definitions.

**Still open**
- Deployment: the Vercel project still has to be imported by hand (the Claude↔Vercel
  connection 403s on project creation).
- The Settings, Photos and PIN-change paths have never run against the real database —
  no service-role key is available in a web session. They typecheck and build only.
- The five seeded September days have no stored photo, so the gallery and the report's
  photo appendix are empty until a log is added by picture.

### 2026-09-16 — claude/gallant-babbage-eseube (merged to main)

Built the project from an empty repository.

**Database** (Supabase project `puzwcsrtqtbutypzozvu`, all objects `harper_`-prefixed)
- `supabase/migrations/0001_harper_init.sql`: `harper_behaviors`, `harper_periods`,
  `harper_daily_logs`, `harper_log_periods` (b1–b8 counts + generated `total`),
  `harper_pin_attempts`; five `harper_v_*` views for charting; RLS on with no policies;
  private `harper-logs` storage bucket.
- `supabase/seed_september.sql`: the first five paper logs transcribed — 228 incidents
  across Sept 8–14. The 9/9 and 9/10 forms had blank date boxes and are flagged
  `date_confirmed = false`.

**App**
- PIN gate: `app/api/unlock/route.ts` (timing-safe compare, DB-backed rate limiting),
  `lib/session.ts` (HMAC-signed cookie via Web Crypto), `proxy.ts` (fails closed when
  `SESSION_SECRET` is unset).
- Parsing: `lib/parse.ts` — Claude vision with a strict tool schema, prompted around the
  form's actual tally conventions (repeated digits, `||||` strokes, cursive 6-loops), and
  transcribing raw marks verbatim so a human can check the counts. `lib/image.ts`
  downscales to 1568px client-side before upload.
- Review-before-save: `components/ReviewForm.tsx` / `components/UploadFlow.tsx`. Nothing
  is written until confirmed; low-confidence rows are outlined; a blank date blocks saving;
  duplicate dates prompt to replace. "Enter by hand" works with no API key.
- Views: `app/dashboard` (hero figure, stat tiles, daily totals, stacked breakdown,
  period × behavior heatmap, per-behavior small multiples), `app/data` (table + notes,
  fix-date, delete, photo), `app/report` (printable ARD summary), `app/api/export` (CSV).

**Infrastructure**
- Next 16 + React 19, Tailwind v4, no chart library (charts are hand-authored SVG).
- Upgraded off Next 15.5.4 (CVE-2025-66478); `npm audit --omit=dev` is clean.
- Deployment is manual-import pending: the Claude↔Vercel connection lacks
  project-creation permission. See the setup checklist handed to the user.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
