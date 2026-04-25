CREATE TABLE public.offers (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  job_id      UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  company     TEXT NOT NULL,
  base_salary INTEGER,
  currency    TEXT DEFAULT 'USD',
  bonus       INTEGER,
  equity      TEXT,
  start_date  DATE,
  deadline    DATE,
  status      TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  notes       TEXT,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own offers"   ON public.offers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own offers" ON public.offers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own offers" ON public.offers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own offers" ON public.offers FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_offers_user_id ON public.offers(user_id);
CREATE INDEX idx_offers_job_id  ON public.offers(job_id);
