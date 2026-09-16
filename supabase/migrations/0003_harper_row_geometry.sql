-- Where each row of the paper form sits on the photograph, so the app can draw
-- a tappable box over each one. Stored as fractions of the image (0-1), which
-- survive any resize or thumbnail:
--   { "left": 0.02, "right": 0.98,
--     "bands": [ { "period_key": "community_time", "top": 0.26, "bottom": 0.33 }, ... ] }
--
-- Null for days saved before this existed, and for days with no photo. The app
-- falls back to an even ten-way split, which the user can drag into place.
alter table harper_daily_logs
  add column if not exists row_geometry jsonb;

comment on column harper_daily_logs.row_geometry is
  'Row grid of the form on the photo, as image fractions. See lib/geometry.ts.';
