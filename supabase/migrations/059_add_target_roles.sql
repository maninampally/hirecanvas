-- Add target_roles array to app_users for personalized job discovery
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS target_roles TEXT[] DEFAULT '{}';

-- Index for future "Alerts" functionality
CREATE INDEX IF NOT EXISTS idx_app_users_target_roles ON public.app_users USING GIN (target_roles);
