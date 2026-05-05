-- Public sharing of read-only pipeline views for mentors/coaches.

CREATE TABLE public.shared_views (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL UNIQUE,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.shared_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own shared views"   ON public.shared_views FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own shared views" ON public.shared_views FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own shared views" ON public.shared_views FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own shared views" ON public.shared_views FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Anyone can read active shares by token" ON public.shared_views FOR SELECT USING (is_active = TRUE);
CREATE INDEX idx_shared_views_user_id ON public.shared_views(user_id);
CREATE INDEX idx_shared_views_token   ON public.shared_views(share_token) WHERE is_active = TRUE;
