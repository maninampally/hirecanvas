CREATE TABLE public.app_users (
  id                       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name                TEXT,
  avatar_url               TEXT,
  phone                    TEXT,
  bio                      TEXT,
  tier                     TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'elite', 'admin')),
  stripe_customer_id       TEXT,
  tier_expires_at          TIMESTAMP WITH TIME ZONE,
  is_suspended             BOOLEAN DEFAULT FALSE,
  onboarding_completed     BOOLEAN NOT NULL DEFAULT FALSE,
  referral_code            TEXT UNIQUE,
  referred_by              UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  referral_credits_months  INTEGER NOT NULL DEFAULT 0,
  timezone                 TEXT,
  created_at               TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at               TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own data"   ON public.app_users FOR SELECT USING (auth.uid() = id OR auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Users can update own data" ON public.app_users FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE INDEX idx_app_users_tier       ON public.app_users(tier);
CREATE INDEX idx_app_users_created_at ON public.app_users(created_at DESC);
CREATE INDEX idx_app_users_timezone   ON public.app_users(timezone);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.app_users (id, full_name, tier, tier_expires_at, created_at, updated_at)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''), 'pro', NOW() + INTERVAL '14 days', NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
