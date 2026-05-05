-- The daily sync scheduler references timezone_offset_minutes but no
-- migration ever added the column.

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS timezone_offset_minutes INTEGER DEFAULT NULL;

COMMENT ON COLUMN public.app_users.timezone_offset_minutes
  IS 'User timezone offset from UTC in minutes (e.g. -300 for EST). Used for scheduled sync timing.';
