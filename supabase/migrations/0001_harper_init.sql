-- Harper Behavior Log — schema
-- Lives inside an existing Supabase project; every object is prefixed harper_
-- so it never collides with anything else in this database.

-- ---------------------------------------------------------------- lookups --

create table if not exists harper_behaviors (
  code        smallint primary key check (code between 1 and 8),
  label       text not null,
  short_label text not null,
  color       text not null
);

create table if not exists harper_periods (
  key        text primary key,
  label      text not null,
  time_range text not null,
  sort_order smallint not null
);

-- ------------------------------------------------------------------ data --

create table if not exists harper_daily_logs (
  id             uuid primary key default gen_random_uuid(),
  log_date       date not null unique,
  day_of_week    text,
  image_path     text,
  date_confirmed boolean not null default false,
  overall_note   text,
  raw_parse      jsonb,
  parsed_by      text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists harper_log_periods (
  id               uuid primary key default gen_random_uuid(),
  log_id           uuid not null references harper_daily_logs(id) on delete cascade,
  period_key       text not null references harper_periods(key),
  specials_subject text,
  antecedent       text,
  notes            text,
  raw_tally        text,
  smiley_count     smallint not null default 0,
  not_observed     boolean not null default false,
  confidence       text not null default 'high' check (confidence in ('high','medium','low')),
  b1 smallint not null default 0 check (b1 >= 0),
  b2 smallint not null default 0 check (b2 >= 0),
  b3 smallint not null default 0 check (b3 >= 0),
  b4 smallint not null default 0 check (b4 >= 0),
  b5 smallint not null default 0 check (b5 >= 0),
  b6 smallint not null default 0 check (b6 >= 0),
  b7 smallint not null default 0 check (b7 >= 0),
  b8 smallint not null default 0 check (b8 >= 0),
  total smallint generated always as (b1+b2+b3+b4+b5+b6+b7+b8) stored,
  unique (log_id, period_key)
);

create index if not exists harper_log_periods_log_id_idx on harper_log_periods (log_id);
create index if not exists harper_daily_logs_date_idx on harper_daily_logs (log_date desc);

-- brute-force throttling for the PIN gate
create table if not exists harper_pin_attempts (
  id  bigserial primary key,
  ip  text not null,
  ok  boolean not null default false,
  at  timestamptz not null default now()
);
create index if not exists harper_pin_attempts_ip_at_idx on harper_pin_attempts (ip, at desc);

-- ------------------------------------------------------- lock everything --
-- RLS on with zero policies: the anon/authenticated keys can read nothing.
-- The app reaches these tables only through server-side code using the
-- service-role key, which bypasses RLS.

alter table harper_behaviors    enable row level security;
alter table harper_periods      enable row level security;
alter table harper_daily_logs   enable row level security;
alter table harper_log_periods  enable row level security;
alter table harper_pin_attempts enable row level security;

-- ------------------------------------------------------------------ views --
-- security_invoker = true so the views inherit the RLS above rather than
-- running as their owner (which would leak data to the anon key).

create or replace view harper_v_behavior_daily with (security_invoker = true) as
select d.log_date,
       t.code,
       b.label,
       b.short_label,
       b.color,
       sum(t.cnt)::int as count
from harper_daily_logs d
join harper_log_periods p on p.log_id = d.id
cross join lateral (values
  (1::smallint, p.b1), (2, p.b2), (3, p.b3), (4, p.b4),
  (5, p.b5), (6, p.b6), (7, p.b7), (8, p.b8)
) as t(code, cnt)
join harper_behaviors b on b.code = t.code
group by d.log_date, t.code, b.label, b.short_label, b.color;

create or replace view harper_v_daily_totals with (security_invoker = true) as
select d.log_date,
       d.day_of_week,
       d.date_confirmed,
       coalesce(sum(p.total), 0)::int                          as total,
       count(p.id) filter (where p.total > 0)::int             as periods_with_incidents,
       coalesce(sum(p.smiley_count), 0)::int                   as smileys
from harper_daily_logs d
left join harper_log_periods p on p.log_id = d.id
group by d.log_date, d.day_of_week, d.date_confirmed;

create or replace view harper_v_period_totals with (security_invoker = true) as
select pr.key         as period_key,
       pr.label       as period_label,
       pr.time_range,
       pr.sort_order,
       coalesce(sum(p.total), 0)::int              as total,
       count(distinct p.log_id)::int               as days_recorded,
       coalesce(sum(p.smiley_count), 0)::int       as smileys
from harper_periods pr
left join harper_log_periods p on p.period_key = pr.key
group by pr.key, pr.label, pr.time_range, pr.sort_order;

create or replace view harper_v_period_behavior with (security_invoker = true) as
select pr.key   as period_key,
       pr.label as period_label,
       pr.sort_order,
       t.code,
       b.short_label,
       sum(t.cnt)::int as count
from harper_periods pr
join harper_log_periods p on p.period_key = pr.key
cross join lateral (values
  (1::smallint, p.b1), (2, p.b2), (3, p.b3), (4, p.b4),
  (5, p.b5), (6, p.b6), (7, p.b7), (8, p.b8)
) as t(code, cnt)
join harper_behaviors b on b.code = t.code
group by pr.key, pr.label, pr.sort_order, t.code, b.short_label;

create or replace view harper_v_behavior_totals with (security_invoker = true) as
select b.code,
       b.label,
       b.short_label,
       b.color,
       coalesce(sum(v.count), 0)::int as total,
       count(distinct v.log_date) filter (where v.count > 0)::int as days_seen
from harper_behaviors b
left join harper_v_behavior_daily v on v.code = b.code
group by b.code, b.label, b.short_label, b.color;

-- --------------------------------------------------------- seed the lookups --

insert into harper_behaviors (code, label, short_label, color) values
  (1, 'Interrupting',                                      'Interrupting', '#2563eb'),
  (2, 'Shouting',                                          'Shouting',     '#db2777'),
  (3, 'Inappropriate usage of supplies/breaking materials','Supplies',     '#7c3aed'),
  (4, 'Throwing/Kicking/hitting',                          'Aggression',   '#dc2626'),
  (5, 'Cutting papers/materials',                          'Cutting',      '#ea580c'),
  (6, 'Refusal/work refusal',                              'Refusal',      '#0891b2'),
  (7, 'Taking shoes & socks off & throwing them',          'Shoes off',    '#15803d'),
  (8, 'Snacking',                                          'Snacking',     '#a16207')
on conflict (code) do update
  set label = excluded.label,
      short_label = excluded.short_label,
      color = excluded.color;

insert into harper_periods (key, label, time_range, sort_order) values
  ('community_time',  'Community Time', '7:55–8:15',   1),
  ('reading',         'Reading',        '8:15–9:30',   2),
  ('writing',         'Writing',        '9:30–10:30',  3),
  ('lunch',           'Lunch',          '10:30–11:00', 4),
  ('recess',          'Recess',         '11:00–11:30', 5),
  ('math',            'Math',           '11:30–12:20', 6),
  ('specials',        'Specials',       '12:20–1:10',  7),
  ('math_continued',  'Math Continued', '1:10–1:30',   8),
  ('science',         'Science',        '2:05–2:40',   9),
  ('social_studies',  'Social Studies', '2:40–3:15',  10)
on conflict (key) do update
  set label = excluded.label,
      time_range = excluded.time_range,
      sort_order = excluded.sort_order;

-- ------------------------------------------------- private photo storage --

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('harper-logs', 'harper-logs', false, 15728640,
        array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do nothing;
