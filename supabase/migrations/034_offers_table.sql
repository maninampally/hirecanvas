CREATE TABLE IF NOT EXISTS public.offers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  base_salary NUMERIC,
  equity_percent NUMERIC,
  equity_value_estimate NUMERIC,
  cliff_months INTEGER,
  vest_months INTEGER,
  bonus_percent NUMERIC,
  pto_days INTEGER,
  remote_type TEXT,
  benefits_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'offers_user_job_unique'
  ) THEN
    ALTER TABLE public.offers
    ADD CONSTRAINT offers_user_job_unique UNIQUE (user_id, job_id);
  END IF;
END $$;

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'offers' AND policyname = 'Users can view own offers'
  ) THEN
    CREATE POLICY "Users can view own offers"
      ON public.offers FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'offers' AND policyname = 'Users can manage own offers'
  ) THEN
    CREATE POLICY "Users can manage own offers"
      ON public.offers FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_offers_user_id ON public.offers(user_id);
CREATE INDEX IF NOT EXISTS idx_offers_job_id ON public.offers(job_id);
