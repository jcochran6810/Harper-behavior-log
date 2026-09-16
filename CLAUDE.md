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

<!-- newest first; append a new dated entry on every "end session" -->

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
