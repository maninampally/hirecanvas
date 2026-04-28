-- Sprint 7: sync pipeline hardening
--
-- 1. sync_status.truncated + oldest_processed_at
--    Surfaces when a sync hit GMAIL_SYNC_MAX_MESSAGES so the UI can prompt
--    the user to re-run with toDate=oldest. Without this the truncation
--    is silent and old emails are dropped.
--
-- 2. sync_status.extraction_mode
--    Records which mode (balanced / high_recall / high_precision) drove
--    the sync. Long-range backfills auto-switch to high_precision; the
--    column lets us surface that to the user.
--
-- 3. processed_emails.gmail_thread_id
--    Enables thread-depth skip (P3) and per-thread dedupe within a sync.
--    Indexed for the per-user, per-thread count query.

ALTER TABLE public.sync_status
  ADD COLUMN IF NOT EXISTS truncated            BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS oldest_processed_at  TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS extraction_mode      TEXT;

ALTER TABLE public.processed_emails
  ADD COLUMN IF NOT EXISTS gmail_thread_id TEXT;

CREATE INDEX IF NOT EXISTS idx_processed_emails_user_thread
  ON public.processed_emails(user_id, gmail_thread_id)
  WHERE gmail_thread_id IS NOT NULL;
