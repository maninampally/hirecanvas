-- Add envelope metadata (To, CC, BCC) and snippet to processed_emails
-- so the sync logs UI can show richer per-email detail without touching
-- the AI pipeline or increasing LLM costs.

ALTER TABLE public.processed_emails
  ADD COLUMN IF NOT EXISTS to_address  TEXT,
  ADD COLUMN IF NOT EXISTS cc_address  TEXT,
  ADD COLUMN IF NOT EXISTS bcc_address TEXT,
  ADD COLUMN IF NOT EXISTS snippet     TEXT;
