-- Did a human tick "these two are right"?
--
-- Every other number in this app is counted off tally marks, which a person can
-- check against the photograph glyph by glyph. These two are read out of the
-- teacher's sentences instead — "called for assistance", "taken to the office" —
-- which is a judgement, not a measurement, and the one place the reader can be
-- confidently wrong in a way the photo doesn't immediately settle.
--
-- So they get their own confirmation, separate from `verified_at`. That column
-- says someone checked the DAY against the page; this one says someone
-- specifically vouched for these two figures. They are the numbers that would be
-- quoted in a staffing argument, so it is worth being able to say which of them
-- a parent actually stood behind.
--
-- Null means "not confirmed", which is the honest default for a day nobody has
-- ticked. A day saved from the review screen carries whatever the parent ticked
-- there; it is never set on their behalf.

alter table harper_daily_logs
  add column if not exists support_confirmed_at timestamptz;

comment on column harper_daily_logs.support_confirmed_at is
  'When a human confirmed the day''s assistance_count and removed_count specifically. Null = not confirmed. Separate from verified_at, which covers the whole day.';
