-- Add content column to resumes to cache extracted text for AI matching
ALTER TABLE public.resumes ADD COLUMN IF NOT EXISTS content TEXT;

-- Index for text searching if needed later
CREATE INDEX IF NOT EXISTS idx_resumes_content ON public.resumes USING gin(to_tsvector('english', content)) WHERE content IS NOT NULL;
