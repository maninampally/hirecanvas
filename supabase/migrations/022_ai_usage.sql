CREATE TABLE public.ai_usage (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  feature     TEXT NOT NULL CHECK (feature IN ('email_extraction', 'resume_analysis', 'interview_prep', 'job_matching', 'outreach_suggestions')),
  tokens_used INTEGER NOT NULL,
  cost_cents  INTEGER,
  tier        TEXT CHECK (tier IN ('free', 'pro', 'elite', 'admin')),
  status      TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'failed', 'partial')),
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own usage"  ON public.ai_usage FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all usage" ON public.ai_usage FOR SELECT USING (EXISTS (SELECT 1 FROM public.app_users WHERE app_users.id = auth.uid() AND app_users.tier = 'admin'));
CREATE POLICY "Service can insert usage"  ON public.ai_usage FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
CREATE INDEX idx_ai_usage_user_id    ON public.ai_usage(user_id);
CREATE INDEX idx_ai_usage_feature    ON public.ai_usage(feature);
CREATE INDEX idx_ai_usage_created_at ON public.ai_usage(created_at DESC);
CREATE INDEX idx_ai_usage_tier       ON public.ai_usage(tier);
