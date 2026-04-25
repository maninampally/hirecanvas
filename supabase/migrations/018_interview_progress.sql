CREATE TABLE public.interview_progress (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  question_id  UUID NOT NULL REFERENCES public.interview_questions(id) ON DELETE CASCADE,
  user_answer  TEXT,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, question_id)
);

ALTER TABLE public.interview_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own progress"   ON public.interview_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own progress" ON public.interview_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own progress" ON public.interview_progress FOR UPDATE USING (auth.uid() = user_id);
CREATE INDEX idx_interview_progress_user_id     ON public.interview_progress(user_id);
CREATE INDEX idx_interview_progress_question_id ON public.interview_progress(question_id);
