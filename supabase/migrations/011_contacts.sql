CREATE TABLE public.contacts (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  email             TEXT,
  phone             TEXT,
  company           TEXT,
  title             TEXT,
  relationship      TEXT CHECK (relationship IN ('Recruiter', 'Hiring Manager', 'Employee', 'Other')),
  linkedin_url      TEXT,
  notes             TEXT,
  last_contacted_at TIMESTAMP WITH TIME ZONE,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own contacts"   ON public.contacts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create contacts"     ON public.contacts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own contacts" ON public.contacts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own contacts" ON public.contacts FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_contacts_user_id ON public.contacts(user_id);
CREATE INDEX idx_contacts_company ON public.contacts(company);
