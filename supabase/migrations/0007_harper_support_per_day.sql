-- Move "assistance called" and "removed from class" from the period rows to the day.
--
-- 0006 put these on harper_log_periods, one pair per class period. That is not how
-- they are recorded: they belong in a box at the top of the day's form, counted
-- once for the whole day. Per-period would have meant asking someone to decide
-- which class a removal "belonged" to, which is a decision the paper never makes
-- and a parent shouldn't have to invent.
--
-- No data moves because there is none — the log was cleared before either column
-- ever held a value.
--
-- They stay out of every incident total, exactly as before: the eight numbered
-- behaviors describe what Harper did, and these two describe what the school did
-- about it. Counting a removal as an incident would report one event twice.

alter table harper_daily_logs
  add column if not exists assistance_count smallint not null default 0
    check (assistance_count >= 0),
  add column if not exists removed_count smallint not null default 0
    check (removed_count >= 0);

comment on column harper_daily_logs.assistance_count is
  'Times another adult was called into the room that day. Not a behavior; never part of an incident total.';
comment on column harper_daily_logs.removed_count is
  'Times Harper was taken out of the classroom that day, as a consequence of behavior. Not a behavior; never part of an incident total.';

alter table harper_log_periods
  drop column if exists assistance_count,
  drop column if exists removed_count;
