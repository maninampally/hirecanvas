CREATE TABLE public.outreach (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  contact_id    UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  company       TEXT NOT NULL,
  contact_name  TEXT,
  contact_email TEXT,
  method        TEXT CHECK (method IN ('LinkedIn', 'Email', 'Phone', 'WhatsApp')),
  status        TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'replied', 'no_response')),
  message       TEXT,
  notes         TEXT,
  outreach_date DATE,
  reply_date    DATE,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.outreach ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own outreach"   ON public.outreach FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create outreach"     ON public.outreach FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own outreach" ON public.outreach FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own outreach" ON public.outreach FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_outreach_user_id ON public.outreach(user_id);
CREATE INDEX idx_outreach_status  ON public.outreach(status);
