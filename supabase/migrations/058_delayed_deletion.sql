-- Add scheduled_deletion_at column to app_users
ALTER TABLE public.app_users 
ADD COLUMN IF NOT EXISTS scheduled_deletion_at TIMESTAMPTZ DEFAULT NULL;

-- Create an index to help the cleanup worker find expired accounts quickly
CREATE INDEX IF NOT EXISTS idx_app_users_scheduled_deletion_at 
ON public.app_users (scheduled_deletion_at) 
WHERE scheduled_deletion_at IS NOT NULL;
