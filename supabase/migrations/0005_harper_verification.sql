-- Which numbers has a human actually checked against the paper?
--
-- Every day in this app started life as a transcription — either the vision
-- reader's, or (for the five September logs) a hand transcription made from
-- photographs that were never kept. Until someone holds a day up against the
-- original page, its numbers are a claim, not a record. An ARD/IEP packet that
-- cannot tell those two apart is weaker than one that can, so the distinction
-- is stored rather than assumed.
--
-- verified_at is null for every existing day, which is the truth: none of them
-- has been checked against paper. It is set when a human confirms or corrects
-- a day in the app.

alter table harper_daily_logs
  add column if not exists verified_at timestamptz,
  add column if not exists verified_note text;

comment on column harper_daily_logs.verified_at is
  'When a human last confirmed this day''s numbers against the original page. Null = never checked.';
comment on column harper_daily_logs.verified_note is
  'Optional note left by whoever checked the day, e.g. which rows were corrected.';

-- ---------------------------------------------------------------------------
-- Data fix: 9/10 specials claimed both "couldn't observe" and 10 incidents.
--
-- The two cannot both be true, and the app has refused that combination at
-- review time since the counting rewrite — this row predates the rule. The
-- counts are cleared rather than the flag, because an IEP record must never
-- overstate: a period nobody could watch cannot supply evidence of behavior.
--
-- raw_tally is deliberately LEFT IN PLACE. The marks are the evidence; if the
-- paper shows they really belong to this row, the day page offers a one-tap
-- "use the count from the marks" to put them back. Nothing is lost, and the
-- day drops from 66 incidents to 56.
-- ---------------------------------------------------------------------------

update harper_log_periods p
   set b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, b7 = 0, b8 = 0,
       confidence = 'low',
       notes = coalesce(p.notes, '')
               || ' [Not counted: this row is marked "couldn''t observe this period",'
               || ' so the tally marks transcribed here were not added to the day.'
               || ' Check the page and re-count this row if the marks belong here.]'
 from harper_daily_logs l
where p.log_id = l.id
  and l.log_date = '2026-09-10'
  and p.period_key = 'specials'
  and p.not_observed
  and p.total > 0;
