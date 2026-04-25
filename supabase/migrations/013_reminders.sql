CREATE TABLE public.reminders (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  job_id       UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  type         TEXT CHECK (type IN ('Follow Up', 'Apply Deadline', 'Interview Prep', 'Other')),
  notes        TEXT,
  due_date     DATE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own reminders"   ON public.reminders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create reminders"     ON public.reminders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reminders" ON public.reminders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reminders" ON public.reminders FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_reminders_user_id     ON public.reminders(user_id);
CREATE INDEX idx_reminders_due_date    ON public.reminders(due_date);
CREATE INDEX idx_reminders_completed_at ON public.reminders(completed_at);
