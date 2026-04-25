CREATE TABLE public.billing_events (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  stripe_event_id     TEXT UNIQUE,
  stripe_customer_id  TEXT,
  event_type          TEXT NOT NULL,
  amount_cents        INTEGER,
  currency            TEXT DEFAULT 'usd',
  status              TEXT,
  metadata            JSONB,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own billing events" ON public.billing_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can insert billing"   ON public.billing_events FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
CREATE INDEX idx_billing_events_user_id    ON public.billing_events(user_id);
CREATE INDEX idx_billing_events_created_at ON public.billing_events(created_at DESC);
