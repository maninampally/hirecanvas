-- Migration: Create extraction_audit_log table
CREATE TABLE public.extraction_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  extraction_type TEXT CHECK (extraction_type IN ('email_sync', 'job_email', 'resume_analysis', 'manual_entry')),
  resource_type TEXT,
  resource_id TEXT,
  action TEXT NOT NULL,
  status TEXT CHECK (status IN ('initiated', 'in_progress', 'completed', 'failed')),
  extracted_data_checksum TEXT,
  pii_fields_detected TEXT[],
  sanitization_applied BOOLEAN DEFAULT FALSE,
  ip_address TEXT,
  gdpr_compliant BOOLEAN DEFAULT TRUE,
  ccpa_compliant BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.extraction_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own extraction logs"
  ON public.extraction_audit_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all extraction logs"
  ON public.extraction_audit_log FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.app_users WHERE app_users.id = auth.uid() AND app_users.tier = 'admin'));

CREATE INDEX idx_extraction_audit_log_user_id ON public.extraction_audit_log(user_id);
CREATE INDEX idx_extraction_audit_log_created_at ON public.extraction_audit_log(created_at DESC);
CREATE INDEX idx_extraction_audit_log_status ON public.extraction_audit_log(status);
