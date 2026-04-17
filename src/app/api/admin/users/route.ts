import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { recordAuditEvent } from '@/lib/security/audit'
import { createServiceClient } from '@/lib/supabase/service'

type UserTier = 'free' | 'pro' | 'elite' | 'admin'

async function assertAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized', status: 401 as const }

  const { data: appUser } = await supabase
    .from('app_users')
    .select('id,tier')
    .eq('id', user.id)
    .single<{ id: string; tier: UserTier }>()

  if (!appUser || appUser.tier !== 'admin') {
    return { error: 'Forbidden', status: 403 as const }
  }

  return { adminUserId: appUser.id }
}

export async function GET() {
  const authResult = await assertAdmin()
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const service = createServiceClient()

  const [{ data: appUsers }, authUsersResponse] = await Promise.all([
    service
      .from('app_users')
      .select('id,full_name,tier,is_suspended,created_at')
      .order('created_at', { ascending: false }),
    service.auth.admin.listUsers({ page: 1, perPage: 500 }),
  ])

  const authUsersById = new Map(
    (authUsersResponse.data?.users || []).map((item) => [item.id, item.email || ''])
  )

  const users = (appUsers || []).map((item) => ({
    ...item,
    email: authUsersById.get(item.id) || '',
  }))

  return NextResponse.json({ users })
}

export async function PATCH(request: NextRequest) {
  const authResult = await assertAdmin()
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const body = (await request.json()) as {
    userId?: string
    tier?: UserTier
    isSuspended?: boolean
  }

  if (!body.userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (body.tier) patch.tier = body.tier
  if (typeof body.isSuspended === 'boolean') patch.is_suspended = body.isSuspended

  const service = createServiceClient()
  const { data, error } = await service
    .from('app_users')
    .update(patch)
    .eq('id', body.userId)
    .select('id,full_name,tier,is_suspended,created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await recordAuditEvent({
    userId: authResult.adminUserId,
    eventType: 'admin_user_updated',
    action: 'admin_update_user',
    resourceType: 'app_users',
    resourceId: body.userId,
    newValues: patch,
  })

  return NextResponse.json({ user: data })
}
