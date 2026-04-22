import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Missing unsubscribe token' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: pref, error: prefError } = await supabase
    .from('notification_preferences')
    .select('user_id')
    .eq('unsubscribe_token', token)
    .maybeSingle<{ user_id: string }>()

  if (prefError) {
    return NextResponse.json({ error: prefError.message }, { status: 500 })
  }

  if (!pref) {
    return NextResponse.json({ error: 'Invalid unsubscribe token' }, { status: 404 })
  }

  const { error: updateError } = await supabase
    .from('notification_preferences')
    .update({
      email_job_updates: false,
      sync_completion_alerts: false,
      weekly_pipeline_summary: false,
      follow_up_nudges: false,
      daily_digest: false,
      feature_announcements: false,
      marketing_emails: false,
      updated_at: new Date().toISOString(),
    })
    .eq('unsubscribe_token', token)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  await supabase.from('notifications').insert({
    user_id: pref.user_id,
    type: 'email_unsubscribe',
    title: 'Email notifications unsubscribed',
    message: 'All email notifications have been turned off from unsubscribe link.',
    action_url: '/settings?tab=notifications',
  })

  const redirectUrl = new URL('/settings?tab=notifications&unsubscribed=1', request.url)
  return NextResponse.redirect(redirectUrl, 302)
}
