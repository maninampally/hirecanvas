import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceClient()
  const [appUser, jobs, contacts, reminders, templates, notifications, outreach, aiUsage] =
    await Promise.all([
      service.from('app_users').select('*').eq('id', user.id).maybeSingle(),
      service.from('jobs').select('*').eq('user_id', user.id),
      service.from('contacts').select('*').eq('user_id', user.id),
      service.from('reminders').select('*').eq('user_id', user.id),
      service.from('templates').select('*').eq('user_id', user.id),
      service.from('notifications').select('*').eq('user_id', user.id),
      service.from('outreach').select('*').eq('user_id', user.id),
      service.from('ai_usage').select('*').eq('user_id', user.id),
    ])

  const payload = {
    exported_at: new Date().toISOString(),
    user_id: user.id,
    data: {
      app_user: appUser.data || null,
      jobs: jobs.data || [],
      contacts: contacts.data || [],
      reminders: reminders.data || [],
      templates: templates.data || [],
      notifications: notifications.data || [],
      outreach: outreach.data || [],
      ai_usage: aiUsage.data || [],
    },
  }

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="hirecanvas-export-${user.id}.json"`,
    },
  })
}
