-- Migration: Add archive support to jobs table
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_jobs_user_archived
  ON public.jobs(user_id, is_archived);
