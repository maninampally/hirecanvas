-- Migration: Create mfa_config table
CREATE TABLE public.mfa_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES public.app_users(id) ON DELETE CASCADE,
  totp_secret TEXT,
  is_enabled BOOLEAN DEFAULT FALSE,
  backup_codes TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.mfa_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own MFA config"
  ON public.mfa_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own MFA"
  ON public.mfa_config FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX idx_mfa_config_user_id ON public.mfa_config(user_id);
