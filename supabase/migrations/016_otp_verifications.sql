-- Migration: Create otp_verifications table
CREATE TABLE public.otp_verifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  otp_code TEXT NOT NULL,
  purpose TEXT CHECK (purpose IN ('extraction_consent', 'login_verification')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  attempt_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own OTPs"
  ON public.otp_verifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX idx_otp_verifications_user_id ON public.otp_verifications(user_id);
CREATE INDEX idx_otp_verifications_expires_at ON public.otp_verifications(expires_at);
