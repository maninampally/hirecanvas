-- Migration 030: Persist onboarding completion state
ALTER TABLE public.app_users
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE;

