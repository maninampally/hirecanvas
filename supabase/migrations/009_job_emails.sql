CREATE TABLE public.job_emails (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id           UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  gmail_message_id TEXT NOT NULL UNIQUE,
  from_address     TEXT NOT NULL,
  subject          TEXT NOT NULL,
  body             TEXT,
  snippet          TEXT,
  received_at      TIMESTAMP WITH TIME ZONE NOT NULL,
  is_read          BOOLEAN DEFAULT FALSE,
  extracted_data   JSONB,
  email_direction  TEXT NOT NULL DEFAULT 'unknown' CHECK (email_direction IN ('outbound', 'inbound', 'unknown')),
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.job_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own job emails"   ON public.job_emails FOR SELECT USING (EXISTS (SELECT 1 FROM public.jobs WHERE jobs.id = job_emails.job_id AND jobs.user_id = auth.uid()));
CREATE POLICY "Users can insert own job emails" ON public.job_emails FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.jobs WHERE jobs.id = job_emails.job_id AND jobs.user_id = auth.uid()));
CREATE INDEX idx_job_emails_job_id           ON public.job_emails(job_id);
CREATE INDEX idx_job_emails_gmail_message_id ON public.job_emails(gmail_message_id);
CREATE INDEX idx_job_emails_received_at      ON public.job_emails(job_id, received_at DESC);
CREATE INDEX idx_job_emails_direction        ON public.job_emails(email_direction);
