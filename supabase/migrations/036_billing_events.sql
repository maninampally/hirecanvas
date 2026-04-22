-- Migration 036: Stripe billing event ledger

CREATE TABLE IF NOT EXISTS public.billing_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT,
  amount_cents INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'usd',
  period_start TIMESTAMP WITH TIME ZONE,
  period_end TIMESTAMP WITH TIME ZONE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'billing_events'
      AND policyname = 'Users can view own billing events'
  ) THEN
    CREATE POLICY "Users can view own billing events"
      ON public.billing_events FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'billing_events'
      AND policyname = 'Admins can view all billing events'
  ) THEN
    CREATE POLICY "Admins can view all billing events"
      ON public.billing_events FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.app_users
          WHERE app_users.id = auth.uid()
            AND app_users.tier = 'admin'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_billing_events_user_id ON public.billing_events(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_type ON public.billing_events(event_type);
CREATE INDEX IF NOT EXISTS idx_billing_events_subscription_id ON public.billing_events(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_created_at ON public.billing_events(created_at DESC);
