-- Training samples: what the reader said about one cell, and what a human
-- confirmed it actually was.
--
-- This is the dataset for a future model that counts this teacher's tally marks.
-- The public handwriting corpora (MNIST, IAM and friends) teach "what character
-- is this", which is not the question here — the questions are "how many of them
-- are there" and "what does this teacher's shorthand mean". Only these pages
-- answer those, so every confirmed review is worth keeping.
--
-- Deliberately NOT storing a copy of the cropped image. A crop is fully
-- determined by the photo, the row grid and the period, all of which are already
-- stored — so crops are regenerated on demand, at any resolution, and they
-- improve retroactively when a grid is realigned.
--
-- Append-only: a later correction of the same row is a new sample, not an edit.
-- The newest sample for a (log_date, period_key) is the label.
create table if not exists harper_training_samples (
  id               uuid primary key default gen_random_uuid(),
  log_id           uuid references harper_daily_logs(id) on delete set null,
  log_date         date not null,
  period_key       text not null references harper_periods(key),

  -- Where the crop comes from. box is {left,right,top,bottom} as image
  -- fractions, copied at confirm time so a later realignment can't silently
  -- change what a stored label refers to.
  image_path       text,
  box              jsonb,

  -- What the machine produced, before any human touched it.
  model_raw_tally  text,
  model_counts     jsonb not null,
  model_confidence text,

  -- What the human confirmed. This is the label.
  human_counts     jsonb not null,
  human_not_observed boolean not null default false,
  corrected        boolean not null,

  -- 'review' = confirmed on the way in; 'correction' = fixed later on the day page.
  source           text not null check (source in ('review', 'correction')),
  created_at       timestamptz not null default now()
);

create index if not exists harper_training_samples_date_idx
  on harper_training_samples (log_date desc, period_key);
create index if not exists harper_training_samples_corrected_idx
  on harper_training_samples (corrected) where corrected;

-- Same posture as every other table here: RLS on, no policies, so the public
-- keys can read nothing and only server-side service-role code reaches it.
alter table harper_training_samples enable row level security;
