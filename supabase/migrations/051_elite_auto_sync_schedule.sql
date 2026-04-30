-- Add auto_sync_time column to app_users for elite plan auto-sync scheduling
-- Stores time in HH:MM format (24-hour) or NULL if not set
-- Only elite users can have this value set

ALTER TABLE public.app_users ADD COLUMN auto_sync_time TEXT DEFAULT NULL;

-- Add constraint: auto_sync_time only allowed for elite users
ALTER TABLE public.app_users ADD CONSTRAINT check_auto_sync_time_elite_only 
  CHECK (auto_sync_time IS NULL OR tier = 'elite');

-- Add index for efficient scheduler queries
CREATE INDEX idx_app_users_elite_with_sync_time 
  ON public.app_users(id) 
  WHERE tier = 'elite' AND auto_sync_time IS NOT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.app_users.auto_sync_time IS 'Auto-sync time in HH:MM format (24-hour). Only allowed for elite users. NULL means auto-sync disabled.';
