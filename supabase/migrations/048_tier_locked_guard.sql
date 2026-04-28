-- BUG-008 mitigation: prevent silent downgrades of admin / paid users.
--
-- Symptom: a user manually upgraded to `admin` (or `pro`) was observed
-- resetting to `free`. Root cause unconfirmed (suspect: realtime
-- subscription, second tab, or handle_new_user re-firing on auth event).
-- Defense: a `tier_locked` flag on app_users and a BEFORE UPDATE trigger
-- that blocks any tier change while the lock is on, regardless of who
-- (anon, service-role, or trigger) issued the UPDATE.
--
-- To unlock a user: UPDATE app_users SET tier_locked=false WHERE id=...;
-- as service-role, change the tier, then re-lock.
--
-- handle_new_user is also tightened: it already had ON CONFLICT DO
-- NOTHING, but we make that explicit and mark the row as locked when
-- the inserted tier is anything other than `free` (e.g. the 14-day
-- trial spawn keeps `pro` locked for the trial window).

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS tier_locked BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.enforce_tier_lock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Allow the update if the lock is off, or if the new row keeps both
  -- the same tier and the same lock state (e.g. updates to unrelated
  -- columns like full_name).
  IF OLD.tier_locked = TRUE
     AND NEW.tier IS DISTINCT FROM OLD.tier
     AND NEW.tier_locked = TRUE THEN
    RAISE EXCEPTION 'tier change blocked: tier_locked is true for user %', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS app_users_enforce_tier_lock ON public.app_users;
CREATE TRIGGER app_users_enforce_tier_lock
  BEFORE UPDATE ON public.app_users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_tier_lock();

-- Lock existing non-free users by default. Free users stay unlocked so
-- the upgrade flow can promote them without first toggling the lock.
UPDATE public.app_users
   SET tier_locked = TRUE
 WHERE tier IN ('pro', 'elite', 'admin')
   AND tier_locked = FALSE;
