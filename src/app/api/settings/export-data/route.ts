import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
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
  
  // Use Promise.allSettled to handle partial failures gracefully
  const results = await Promise.allSettled([
    service.from('app_users').select('*').eq('id', user.id).maybeSingle(),
    service.from('jobs').select('*').eq('user_id', user.id),
    service.from('contacts').select('*').eq('user_id', user.id),
    service.from('reminders').select('*').eq('user_id', user.id),
    service.from('templates').select('*').eq('user_id', user.id),
    service.from('notifications').select('*').eq('user_id', user.id),
    service.from('outreach').select('*').eq('user_id', user.id),
    service.from('ai_usage').select('*').eq('user_id', user.id),
  ])

  const tables = [
    'app_users',
    'jobs',
    'contacts',
    'reminders',
    'templates',
    'notifications',
    'outreach',
    'ai_usage',
  ] as const

  const tableErrors: Record<string, string> = {}
  const data: Record<string, unknown> = {}

  for (let i = 0; i < tables.length; i++) {
    const table = tables[i]
    const result = results[i]

    if (result.status === 'rejected') {
      tableErrors[table] = `Promise rejected: ${result.reason?.message || String(result.reason)}`
      data[table] = table === 'app_users' ? null : []
    } else {
      const res = result.value
      if (res.error) {
        tableErrors[table] = res.error.message
        data[table] = table === 'app_users' ? null : []
      } else {
        data[table] = res.data || (table === 'app_users' ? null : [])
      }
    }
  }

  const payload = {
    exported_at: new Date().toISOString(),
    user_id: user.id,
    ...(Object.keys(tableErrors).length > 0 ? { export_errors: tableErrors } : {}),
    data,
  }

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="hirecanvas-export-${user.id}.json"`,
    },
  })
}
