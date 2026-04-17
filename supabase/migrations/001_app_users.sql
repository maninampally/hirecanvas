-- Migration: Create app_users table (extends auth.users)
CREATE TABLE public.app_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  bio TEXT,
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'elite', 'admin')),
  stripe_customer_id TEXT,
  tier_expires_at TIMESTAMP WITH TIME ZONE,
  is_suspended BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data"
  ON public.app_users FOR SELECT
  USING (auth.uid() = id OR auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Users can update own data"
  ON public.app_users FOR UPDATE
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE INDEX idx_app_users_tier ON public.app_users(tier);
CREATE INDEX idx_app_users_created_at ON public.app_users(created_at DESC);
