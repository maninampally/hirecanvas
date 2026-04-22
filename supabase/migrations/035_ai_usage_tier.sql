-- Migration: Track user tier on ai_usage rows for extraction analytics.

ALTER TABLE public.ai_usage
ADD COLUMN IF NOT EXISTS tier TEXT CHECK (tier IN ('free', 'pro', 'elite', 'admin'));

CREATE INDEX IF NOT EXISTS idx_ai_usage_tier ON public.ai_usage(tier);
