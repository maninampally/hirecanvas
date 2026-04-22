ALTER TABLE public.job_emails
ADD COLUMN IF NOT EXISTS email_direction TEXT NOT NULL DEFAULT 'unknown'
CHECK (email_direction IN ('outbound', 'inbound', 'unknown'));

CREATE INDEX IF NOT EXISTS idx_job_emails_direction ON public.job_emails(email_direction);
