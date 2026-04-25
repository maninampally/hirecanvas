CREATE TABLE public.sync_status (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  status          TEXT NOT NULL CHECK (status IN ('idle', 'in_progress', 'completed', 'failed', 'stopped')),
  total_emails    INTEGER NOT NULL DEFAULT 0,
  processed_count INTEGER NOT NULL DEFAULT 0,
  new_jobs_found  INTEGER NOT NULL DEFAULT 0,
  error_message   TEXT,
  started_at      TIMESTAMP WITH TIME ZONE,
  completed_at    TIMESTAMP WITH TIME ZONE,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.sync_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own sync status"   ON public.sync_status FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sync status" ON public.sync_status FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sync status" ON public.sync_status FOR UPDATE USING (auth.uid() = user_id);
CREATE INDEX idx_sync_status_user_id     ON public.sync_status(user_id);
CREATE INDEX idx_sync_status_updated_at  ON public.sync_status(updated_at DESC);
CREATE INDEX idx_sync_status_user_latest ON public.sync_status(user_id, updated_at DESC);

-- Called nightly by the digest worker to prevent unbounded row growth
CREATE OR REPLACE FUNCTION public.cleanup_old_sync_status()
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  DELETE FROM public.sync_status
  WHERE id NOT IN (
    SELECT id FROM (
      SELECT id,
             ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC) AS rn
      FROM public.sync_status
    ) sub
    WHERE rn <= 10
  );
$$;
