CREATE TABLE public.resumes (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  storage_path TEXT UNIQUE NOT NULL,
  file_size    INTEGER,
  file_type    TEXT,
  version      INTEGER DEFAULT 1,
  is_default   BOOLEAN DEFAULT FALSE,
  ats_score    INTEGER CHECK (ats_score >= 0 AND ats_score <= 100),
  ats_analysis JSONB,
  uploaded_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own resumes"   ON public.resumes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own resumes" ON public.resumes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own resumes" ON public.resumes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own resumes" ON public.resumes FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_resumes_user_id    ON public.resumes(user_id);
CREATE INDEX idx_resumes_is_default ON public.resumes(is_default);
