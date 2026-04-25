import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as { confirm?: string }
  if (body.confirm !== 'DELETE') {
    return NextResponse.json({ error: 'Confirmation text must be DELETE' }, { status: 400 })
  }

  const service = createServiceClient()

  // Best effort data cleanup for user-owned rows before removing auth user.
  await Promise.all([
    service.from('notifications').delete().eq('user_id', user.id),
    service.from('ai_usage').delete().eq('user_id', user.id),
    service.from('outreach').delete().eq('user_id', user.id),
    service.from('reminders').delete().eq('user_id', user.id),
    service.from('contacts').delete().eq('user_id', user.id),
    service.from('templates').delete().eq('user_id', user.id),
    service.from('oauth_tokens').delete().eq('user_id', user.id),
    service.from('notification_preferences').delete().eq('user_id', user.id),
  ])

  const { error: deleteError } = await service.auth.admin.deleteUser(user.id)
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  await supabase.auth.signOut()

  return NextResponse.json({ success: true })
}
