CREATE TABLE public.notification_preferences (
  id                       UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                  UUID NOT NULL UNIQUE REFERENCES public.app_users(id) ON DELETE CASCADE,
  email_job_updates        BOOLEAN NOT NULL DEFAULT true,
  sync_completion_alerts   BOOLEAN NOT NULL DEFAULT true,
  weekly_pipeline_summary  BOOLEAN NOT NULL DEFAULT true,
  follow_up_nudges         BOOLEAN NOT NULL DEFAULT true,
  daily_digest             BOOLEAN NOT NULL DEFAULT true,
  feature_announcements    BOOLEAN NOT NULL DEFAULT false,
  marketing_emails         BOOLEAN NOT NULL DEFAULT false,
  unsubscribe_token        TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(18), 'hex'),
  created_at               TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at               TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own prefs"   ON public.notification_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own prefs" ON public.notification_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own prefs" ON public.notification_preferences FOR UPDATE USING (auth.uid() = user_id);
