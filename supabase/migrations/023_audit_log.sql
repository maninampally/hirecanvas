CREATE TABLE public.audit_log (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  event_type    TEXT NOT NULL,
  action        TEXT,
  resource_type TEXT,
  resource_id   TEXT,
  old_values    JSONB,
  new_values    JSONB,
  ip_address    TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own audit log"  ON public.audit_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all audit log" ON public.audit_log FOR SELECT USING (EXISTS (SELECT 1 FROM public.app_users WHERE app_users.id = auth.uid() AND app_users.tier = 'admin'));
CREATE POLICY "Service can insert audit"      ON public.audit_log FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
CREATE INDEX idx_audit_log_user_id    ON public.audit_log(user_id);
CREATE INDEX idx_audit_log_created_at ON public.audit_log(user_id, created_at DESC);
