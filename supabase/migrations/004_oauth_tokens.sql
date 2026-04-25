CREATE TABLE public.oauth_tokens (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                 UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  provider                TEXT NOT NULL CHECK (provider IN ('google_gmail', 'linkedin', 'github')),
  provider_email          TEXT NOT NULL,
  access_token_encrypted  TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  id_token_encrypted      TEXT,
  expires_at              TIMESTAMP WITH TIME ZONE,
  scopes                  TEXT[],
  is_revoked              BOOLEAN DEFAULT FALSE,
  last_history_id         TEXT,
  created_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, provider, provider_email)
);

ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own tokens"   ON public.oauth_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tokens" ON public.oauth_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tokens" ON public.oauth_tokens FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tokens" ON public.oauth_tokens FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_oauth_tokens_user_id               ON public.oauth_tokens(user_id);
CREATE INDEX idx_oauth_tokens_provider              ON public.oauth_tokens(provider);
CREATE INDEX idx_oauth_tokens_provider_email        ON public.oauth_tokens(provider_email);
CREATE INDEX idx_oauth_tokens_user_provider_history ON public.oauth_tokens(user_id, provider, last_history_id);
