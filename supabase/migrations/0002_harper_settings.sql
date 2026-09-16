-- App settings that a parent can change from the site itself, rather than
-- needing a redeploy. Currently just the shared PIN.
--
-- The PIN is never stored in the clear: value holds "scrypt$<salt>$<hash>".
-- When no pin_hash row exists the app falls back to the APP_PIN env var, so an
-- existing deployment keeps working until someone changes the PIN in the UI.

create table if not exists harper_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

alter table harper_settings enable row level security;
