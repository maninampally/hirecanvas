-- Migration 037: Support multiple Gmail accounts without destructive data operations.

-- Add the provider_email column first (nullable while backfilling).
ALTER TABLE public.oauth_tokens
ADD COLUMN IF NOT EXISTS provider_email TEXT;

-- `oauth_tokens.user_id` is already indexed by `idx_oauth_tokens_user_id` from migration 012.
-- Backfill from auth.users email where available.
UPDATE public.oauth_tokens AS t
SET provider_email = lower(nullif(u.email, ''))
FROM auth.users AS u
WHERE t.user_id = u.id
  AND (t.provider_email IS NULL OR t.provider_email = '')
  AND u.email IS NOT NULL
  AND u.email <> '';

-- Ensure all legacy rows have a deterministic non-null identifier.
UPDATE public.oauth_tokens
SET provider_email = concat('legacy-user-id:', user_id::text)
WHERE provider_email IS NULL OR provider_email = '';

-- Replace legacy uniqueness with multi-account uniqueness.
ALTER TABLE public.oauth_tokens
DROP CONSTRAINT IF EXISTS oauth_tokens_user_id_provider_key;

ALTER TABLE public.oauth_tokens
ALTER COLUMN provider_email SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'oauth_tokens_user_id_provider_email_key'
      AND conrelid = 'public.oauth_tokens'::regclass
  ) THEN
    ALTER TABLE public.oauth_tokens
    ADD CONSTRAINT oauth_tokens_user_id_provider_email_key
    UNIQUE (user_id, provider, provider_email);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_oauth_tokens_provider_email
  ON public.oauth_tokens(provider_email);

CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user_provider_is_revoked
  ON public.oauth_tokens(user_id, provider, is_revoked);
