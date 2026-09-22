-- SUPERSEDED BY 0007, which moves both columns onto harper_daily_logs. They are
-- counted once per day, not per class period. Kept as history: the live database
-- ran this, so replaying the files must run it too.
--
-- How often the room needed another adult, and how often Harper left it.
--
-- These are the two facts an ARD committee asks for that the eight numbered
-- behaviors cannot answer. "Interrupting, nine times" describes the child.
-- "Assistance was called four times and she was removed from class twice"
-- describes what the placement currently costs to run, which is the argument for
-- changing it.
--
-- Three deliberate choices:
--
-- 1. They are NOT behaviors 9 and 10. The numbers 1-8 are the teacher's, printed
--    on the paper form, and nothing may be added to them (see CLAUDE.md).
-- 2. They are NOT part of a period's `total`. That column is generated from
--    b1..b8 and stays that way, so every incident figure in the app remains
--    comparable with every figure recorded before today. Counting a removal as an
--    incident would also double-count the behavior that caused it.
-- 3. They are per period, not per day, because that is where the paper records
--    them and because "which class needs the second adult" is the useful question.
--
-- Unlike the tally marks, these are written in prose ("called for assistance",
-- "taken to the office"), so the reader proposes them from the teacher's own
-- wording and every non-zero proposal is flagged for a human on the review
-- screen. The note it read sits next to the number everywhere it is shown.

alter table harper_log_periods
  add column if not exists assistance_count smallint not null default 0
    check (assistance_count >= 0),
  add column if not exists removed_count smallint not null default 0
    check (removed_count >= 0);

comment on column harper_log_periods.assistance_count is
  'Times another adult was called into the room during this period. Not a behavior; deliberately excluded from total.';
comment on column harper_log_periods.removed_count is
  'Times Harper was taken out of the classroom during this period. Not a behavior; deliberately excluded from total.';
