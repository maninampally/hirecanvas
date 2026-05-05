-- Companies as first-class entities for deduplication and per-company analytics.

CREATE TABLE public.companies (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  canonical_name  TEXT NOT NULL,
  domain          TEXT,
  logo_url        TEXT,
  notes           TEXT,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, canonical_name)
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own companies"   ON public.companies FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own companies" ON public.companies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own companies" ON public.companies FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own companies" ON public.companies FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_companies_user_id   ON public.companies(user_id);
CREATE INDEX idx_companies_canonical ON public.companies(user_id, canonical_name);

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON public.jobs(company_id);
