-- Add "Closed" as a valid job status distinct from "Rejected".
-- "Closed" = position cancelled / user withdrew; "Rejected" = company declined.

ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_status_check
  CHECK (status IN ('Wishlist', 'Applied', 'Screening', 'Interview', 'Offer', 'Rejected', 'Closed'));

ALTER TABLE public.job_status_timeline DROP CONSTRAINT IF EXISTS job_status_timeline_status_check;
ALTER TABLE public.job_status_timeline ADD CONSTRAINT job_status_timeline_status_check
  CHECK (status IN ('Wishlist', 'Applied', 'Screening', 'Interview', 'Offer', 'Rejected', 'Closed'));
