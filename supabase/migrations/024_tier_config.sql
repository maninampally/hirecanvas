-- Create tier_config table for admin-controlled feature limits.

CREATE TABLE IF NOT EXISTS public.tier_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tier TEXT NOT NULL UNIQUE CHECK (tier IN ('free', 'pro', 'elite', 'admin')),
  daily_sync_limit INTEGER,
  hourly_sync_limit INTEGER,
  ai_extraction_enabled BOOLEAN NOT NULL DEFAULT false,
  ai_cover_letter_enabled BOOLEAN NOT NULL DEFAULT false,
  ai_coaching_enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES public.app_users(id) ON DELETE SET NULL
);

ALTER TABLE public.tier_config ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tier_config'
      AND policyname = 'Admins can view tier config'
  ) THEN
    CREATE POLICY "Admins can view tier config"
      ON public.tier_config FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.app_users
          WHERE app_users.id = auth.uid()
            AND app_users.tier = 'admin'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tier_config'
      AND policyname = 'Admins can update tier config'
  ) THEN
    CREATE POLICY "Admins can update tier config"
      ON public.tier_config FOR UPDATE
      USING (
        EXISTS (
          SELECT 1
          FROM public.app_users
          WHERE app_users.id = auth.uid()
            AND app_users.tier = 'admin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.app_users
          WHERE app_users.id = auth.uid()
            AND app_users.tier = 'admin'
        )
      );
  END IF;
END $$;

INSERT INTO public.tier_config (
  tier,
  daily_sync_limit,
  hourly_sync_limit,
  ai_extraction_enabled,
  ai_cover_letter_enabled,
  ai_coaching_enabled
)
VALUES
  ('free', NULL, NULL, false, false, false),
  ('pro', 3, NULL, true, false, false),
  ('elite', NULL, 30, true, true, true),
  ('admin', NULL, 60, true, true, true)
ON CONFLICT (tier) DO NOTHING;
