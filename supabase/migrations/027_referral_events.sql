CREATE TABLE public.referral_events (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  code             TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'qualified', 'rewarded')),
  reward_months    INTEGER NOT NULL DEFAULT 1,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(referred_user_id)
);

ALTER TABLE public.referral_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own referral events" ON public.referral_events FOR SELECT USING (auth.uid() = referrer_user_id OR auth.uid() = referred_user_id);
CREATE INDEX idx_referral_events_referrer ON public.referral_events(referrer_user_id, created_at DESC);
