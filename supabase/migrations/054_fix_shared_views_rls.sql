-- Fix: the "Anyone can read active shares by token" policy exposed ALL active
-- rows (including share_token values) to any authenticated user.
-- Public share pages now use the service-role client, so this blanket policy
-- is no longer needed.

DROP POLICY IF EXISTS "Anyone can read active shares by token" ON public.shared_views;
