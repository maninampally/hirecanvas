CREATE TABLE public.interview_questions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category      TEXT NOT NULL,
  difficulty    TEXT NOT NULL CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  question      TEXT NOT NULL,
  sample_answer TEXT,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.interview_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view questions" ON public.interview_questions FOR SELECT USING (auth.role() = 'authenticated');
CREATE INDEX idx_interview_questions_category   ON public.interview_questions(category);
CREATE INDEX idx_interview_questions_difficulty ON public.interview_questions(difficulty);
