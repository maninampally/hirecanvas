-- Migration: Create processed_emails table
CREATE TABLE public.processed_emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  gmail_message_id TEXT NOT NULL,
  from_address TEXT NOT NULL,
  subject TEXT,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, gmail_message_id)
);

ALTER TABLE public.processed_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own processed emails"
  ON public.processed_emails FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX idx_processed_emails_user_id ON public.processed_emails(user_id);
CREATE INDEX idx_processed_emails_processed_at ON public.processed_emails(processed_at DESC);
