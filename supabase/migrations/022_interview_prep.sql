-- Create interview prep tables and seed baseline questions.

CREATE TABLE IF NOT EXISTS public.interview_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  question TEXT NOT NULL,
  sample_answer TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.interview_questions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'interview_questions'
      AND policyname = 'Authenticated users can view interview questions'
  ) THEN
    CREATE POLICY "Authenticated users can view interview questions"
      ON public.interview_questions FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.interview_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.interview_questions(id) ON DELETE CASCADE,
  user_answer TEXT,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, question_id)
);

ALTER TABLE public.interview_progress ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'interview_progress'
      AND policyname = 'Users can view own interview progress'
  ) THEN
    CREATE POLICY "Users can view own interview progress"
      ON public.interview_progress FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'interview_progress'
      AND policyname = 'Users can insert own interview progress'
  ) THEN
    CREATE POLICY "Users can insert own interview progress"
      ON public.interview_progress FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'interview_progress'
      AND policyname = 'Users can update own interview progress'
  ) THEN
    CREATE POLICY "Users can update own interview progress"
      ON public.interview_progress FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_interview_progress_user_id ON public.interview_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_interview_progress_question_id ON public.interview_progress(question_id);

INSERT INTO public.interview_questions (category, difficulty, question, sample_answer)
SELECT *
FROM (
  VALUES
    ('Behavioral', 'Easy', 'Tell me about yourself.', 'Summarize your recent experience, strengths, and what role you want next.'),
    ('Behavioral', 'Medium', 'Describe a time you had to learn something quickly.', 'Use STAR: situation, your learning plan, outcome, and reflection.'),
    ('Behavioral', 'Hard', 'Tell me about a conflict with a teammate and how you resolved it.', 'Focus on communication, empathy, and measurable resolution.'),
    ('Technical', 'Easy', 'Explain the difference between REST and GraphQL.', 'Compare data fetching flexibility, caching patterns, and operational tradeoffs.'),
    ('Technical', 'Medium', 'How would you improve performance of a slow API endpoint?', 'Measure first, identify bottleneck, optimize query/indexes, then verify.'),
    ('Technical', 'Hard', 'Design a resilient email sync system with retries and idempotency.', 'Discuss queues, dedupe keys, backoff, and failure recovery.'),
    ('System Design', 'Medium', 'How would you design a job tracking app backend?', 'Explain schema, auth, RLS, API boundaries, and observability.'),
    ('System Design', 'Hard', 'How would you scale a notification system to millions of users?', 'Partitioning, queue fanout, retry policies, and delivery guarantees.'),
    ('Leadership', 'Medium', 'How do you mentor junior engineers?', 'Describe coaching methods, feedback loops, and growth plans.'),
    ('Leadership', 'Hard', 'How do you handle conflicting priorities across teams?', 'Describe prioritization framework and stakeholder alignment strategy.')
) AS seed(category, difficulty, question, sample_answer)
WHERE NOT EXISTS (
  SELECT 1 FROM public.interview_questions q WHERE q.question = seed.question
);
