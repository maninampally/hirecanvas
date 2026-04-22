-- Migration: Support multiple Gmail accounts

-- Migration: Create oauth_tokens table
-- CREATE TABLE public.oauth_tokens (
--   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
--   user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
--   provider TEXT NOT NULL CHECK (provider IN ('google_gmail', 'linkedin', 'github')),
--   access_token_encrypted TEXT NOT NULL,
--   refresh_token_encrypted TEXT,
--   id_token_encrypted TEXT,
--   expires_at TIMESTAMP WITH TIME ZONE,
--   scopes TEXT[],
--   is_revoked BOOLEAN DEFAULT FALSE,
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
--   updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
--   UNIQUE(user_id, provider)
-- );

-- 1. Create backup
CREATE TABLE IF NOT EXISTS oauth_tokens_backup AS SELECT * FROM oauth_tokens;

-- 2. Clean slate
TRUNCATE TABLE public.oauth_tokens;

-- 3. Drop old constraint
ALTER TABLE public.oauth_tokens 
DROP CONSTRAINT IF EXISTS oauth_tokens_user_id_provider_key;

-- 4. Add email column 
-- We add it as NULLable first so the old data can fit, then set to NOT NULL later
ALTER TABLE public.oauth_tokens ADD COLUMN provider_email TEXT;

-- 5. Restore data
-- Note: We join with app_users to 'guess' the email for existing tokens
INSERT INTO public.oauth_tokens (
    user_id, 
    provider, 
    provider_email, 
    access_token_encrypted, 
    refresh_token_encrypted, 
    expires_at, 
    scopes
)
SELECT 
    b.user_id, 
    b.provider, 
    u.email, -- Use the main account email as the placeholder for old tokens
    b.access_token_encrypted, 
    b.refresh_token_encrypted, 
    b.expires_at, 
    b.scopes
FROM public.oauth_tokens_backup b
JOIN public.app_users u ON b.user_id = u.id;

-- 6. Enforce Constraints
-- Now that data is in, we can make it NOT NULL and add the unique constraint
ALTER TABLE public.oauth_tokens ALTER COLUMN provider_email SET NOT NULL;

ALTER TABLE public.oauth_tokens 
ADD CONSTRAINT oauth_tokens_user_id_provider_email_key UNIQUE (user_id, provider, provider_email);

-- 7. Indexing
CREATE INDEX idx_oauth_tokens_provider_email ON public.oauth_tokens(provider_email);