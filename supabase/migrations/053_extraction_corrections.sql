-- Capture user corrections to AI-extracted job data for prompt evaluation.

CREATE TABLE public.extraction_corrections (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  job_id          UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  original_json   JSONB NOT NULL,
  corrected_json  JSONB NOT NULL,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.extraction_corrections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own corrections"   ON public.extraction_corrections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own corrections" ON public.extraction_corrections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_extraction_corrections_user_id ON public.extraction_corrections(user_id);
CREATE INDEX idx_extraction_corrections_job_id  ON public.extraction_corrections(job_id);
