-- Migration: Create job_status_timeline table
CREATE TABLE public.job_status_timeline (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('Wishlist', 'Applied', 'Screening', 'Interview', 'Offer', 'Rejected')),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  notes TEXT
);

ALTER TABLE public.job_status_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own job timeline"
  ON public.job_status_timeline FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.jobs WHERE jobs.id = job_status_timeline.job_id AND jobs.user_id = auth.uid()));

CREATE INDEX idx_job_status_timeline_job_id ON public.job_status_timeline(job_id);
CREATE INDEX idx_job_status_timeline_changed_at ON public.job_status_timeline(changed_at DESC);
