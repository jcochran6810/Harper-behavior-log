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
5. **Charts, table, report** — all rendered server-side from Postgres views.

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
- `harper_daily_logs` — one row per school day (plus the raw model output, for audit)
- `harper_log_periods` — one row per class period per day, with `b1`…`b8` counts
- `harper_v_*` — views that feed the charts
- `harper-logs` — a **private** storage bucket for the original photos

Row-level security is enabled with no policies, so the public API keys can read nothing.
All access goes through server-side route handlers using the service-role key.

Schema: `supabase/migrations/0001_harper_init.sql`. Seed data from the first five logs:
`supabase/seed_september.sql`.

## Environment variables

See `.env.example`. Four are required: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`APP_PIN`, `SESSION_SECRET`. `ANTHROPIC_API_KEY` is needed only for reading photos —
without it, everything else works and logs can be entered by hand.

## Changing the PIN

Vercel → the project → Settings → Environment Variables → edit `APP_PIN` → redeploy.
No code change.

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in the two secrets
npm run dev
```

## A note on security

A 4-digit PIN is real protection against someone stumbling onto the URL, not against a
determined attacker. The site is `noindex`, the photos are in a private bucket served
through 60-second signed URLs, and failed PIN attempts are rate-limited — but the address
shouldn't be shared more widely than it needs to be.
