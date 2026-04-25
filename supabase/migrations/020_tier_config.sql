CREATE TABLE public.tier_config (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tier                    TEXT NOT NULL UNIQUE CHECK (tier IN ('free', 'pro', 'elite', 'admin')),
  daily_sync_limit        INTEGER,
  hourly_sync_limit       INTEGER,
  ai_extraction_enabled   BOOLEAN NOT NULL DEFAULT false,
  ai_cover_letter_enabled BOOLEAN NOT NULL DEFAULT false,
  ai_coaching_enabled     BOOLEAN NOT NULL DEFAULT false,
  updated_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_by              UUID REFERENCES public.app_users(id) ON DELETE SET NULL
);

ALTER TABLE public.tier_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage tier config"      ON public.tier_config FOR ALL USING (EXISTS (SELECT 1 FROM public.app_users WHERE app_users.id = auth.uid() AND app_users.tier = 'admin'));
CREATE POLICY "Authenticated can view tier config" ON public.tier_config FOR SELECT USING (auth.role() = 'authenticated');

INSERT INTO public.tier_config (tier, daily_sync_limit, hourly_sync_limit, ai_extraction_enabled, ai_cover_letter_enabled, ai_coaching_enabled)
VALUES
  ('free',  0,   0,  false, false, false),
  ('pro',   3,   0,  true,  false, false),
  ('elite', 999, 60, true,  true,  true),
  ('admin', 999, 60, true,  true,  true)
ON CONFLICT (tier) DO NOTHING;
