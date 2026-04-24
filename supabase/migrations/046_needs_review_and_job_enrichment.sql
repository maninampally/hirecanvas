-- Migration: needs_review queue + richer job enrichment fields
-- Supports Opus pipeline audit — FIX 7 (upsert) + FIX 8 (needs review).

-- 1. processed_emails: add review workflow columns
ALTER TABLE public.processed_emails
  ADD COLUMN IF NOT EXISTS review_status TEXT
    CHECK (review_status IN ('auto_accepted','auto_rejected','needs_review','user_accepted','user_rejected')),
  ADD COLUMN IF NOT EXISTS review_reason TEXT,
  ADD COLUMN IF NOT EXISTS borderline_extraction JSONB;

CREATE INDEX IF NOT EXISTS idx_processed_emails_review_status
  ON public.processed_emails(user_id, review_status);

-- 2. jobs: add enrichment fields used by the new extractor
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS recruiter_name TEXT,
  ADD COLUMN IF NOT EXISTS recruiter_email TEXT,
  ADD COLUMN IF NOT EXISTS interview_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS interview_type TEXT,
  ADD COLUMN IF NOT EXISTS salary_range TEXT,
  ADD COLUMN IF NOT EXISTS ats_platform TEXT;

CREATE INDEX IF NOT EXISTS idx_jobs_user_company_role
  ON public.jobs(user_id, company, title);
