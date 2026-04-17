-- Migration: Create email_verify_tokens table
CREATE TABLE public.email_verify_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.email_verify_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tokens"
  ON public.email_verify_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX idx_email_verify_tokens_user_id ON public.email_verify_tokens(user_id);
CREATE INDEX idx_email_verify_tokens_expires_at ON public.email_verify_tokens(expires_at);
