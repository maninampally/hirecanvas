-- Add missing CRUD RLS policies for oauth_tokens and create sync_status table.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'oauth_tokens'
      AND policyname = 'Users can insert own tokens'
  ) THEN
    CREATE POLICY "Users can insert own tokens"
      ON public.oauth_tokens FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'oauth_tokens'
      AND policyname = 'Users can update own tokens'
  ) THEN
    CREATE POLICY "Users can update own tokens"
      ON public.oauth_tokens FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'oauth_tokens'
      AND policyname = 'Users can delete own tokens'
  ) THEN
    CREATE POLICY "Users can delete own tokens"
      ON public.oauth_tokens FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.sync_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('idle', 'in_progress', 'completed', 'failed')),
  total_emails INTEGER NOT NULL DEFAULT 0,
  processed_count INTEGER NOT NULL DEFAULT 0,
  new_jobs_found INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.sync_status ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sync_status'
      AND policyname = 'Users can view own sync status'
  ) THEN
    CREATE POLICY "Users can view own sync status"
      ON public.sync_status FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sync_status'
      AND policyname = 'Users can insert own sync status'
  ) THEN
    CREATE POLICY "Users can insert own sync status"
      ON public.sync_status FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sync_status'
      AND policyname = 'Users can update own sync status'
  ) THEN
    CREATE POLICY "Users can update own sync status"
      ON public.sync_status FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sync_status_user_id ON public.sync_status(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_status_updated_at ON public.sync_status(updated_at DESC);
