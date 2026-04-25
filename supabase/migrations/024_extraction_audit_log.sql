CREATE TABLE public.extraction_audit_log (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id              UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  extraction_type      TEXT CHECK (extraction_type IN ('email_sync', 'job_email', 'resume_analysis', 'manual_entry')),
  resource_type        TEXT,
  resource_id          TEXT,
  action               TEXT,
  status               TEXT,
  pii_fields_detected  TEXT[],
  sanitization_applied BOOLEAN DEFAULT FALSE,
  gdpr_compliant       BOOLEAN DEFAULT TRUE,
  ccpa_compliant       BOOLEAN DEFAULT TRUE,
  created_at           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.extraction_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own extraction audit"  ON public.extraction_audit_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can insert extraction audit"  ON public.extraction_audit_log FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
CREATE INDEX idx_extraction_audit_user_id    ON public.extraction_audit_log(user_id);
CREATE INDEX idx_extraction_audit_created_at ON public.extraction_audit_log(user_id, created_at DESC);
