-- Migration: Create job_resumes table for per-job resume uploads
CREATE TABLE public.job_resumes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.job_resumes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own job resumes"
  ON public.job_resumes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own job resumes"
  ON public.job_resumes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own job resumes"
  ON public.job_resumes FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_job_resumes_job_id ON public.job_resumes(job_id);
CREATE INDEX idx_job_resumes_user_id ON public.job_resumes(user_id);
