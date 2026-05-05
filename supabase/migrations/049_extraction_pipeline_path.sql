-- Add pipeline_path tracking to extraction_audit_log
-- Allows operators to see which optimization path each email took

ALTER TABLE public.extraction_audit_log
ADD COLUMN pipeline_path TEXT
  CHECK (pipeline_path IN (
    'simple_path:auto_accepted',
    'stage1_accepted',
    'stage2_accepted',
    'fast_path_verified',
    'full_verification',
    'needs_review',
    'auto_rejected'
  ));

CREATE INDEX idx_extraction_audit_pipeline_path ON public.extraction_audit_log(user_id, pipeline_path) WHERE pipeline_path IS NOT NULL;
