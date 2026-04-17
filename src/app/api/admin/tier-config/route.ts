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
  const { data, error } = await service
    .from('tier_config')
    .select('id,tier,daily_sync_limit,hourly_sync_limit,ai_extraction_enabled,ai_cover_letter_enabled,ai_coaching_enabled,updated_at,updated_by')
    .order('tier', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ rows: data || [] })
}

export async function PATCH(request: NextRequest) {
  const authResult = await assertAdmin()
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const body = (await request.json()) as {
    tier?: UserTier
    dailySyncLimit?: number | null
    hourlySyncLimit?: number | null
    aiExtractionEnabled?: boolean
    aiCoverLetterEnabled?: boolean
    aiCoachingEnabled?: boolean
  }

  if (!body.tier) {
    return NextResponse.json({ error: 'tier is required' }, { status: 400 })
  }

  const patch = {
    daily_sync_limit: body.dailySyncLimit ?? null,
    hourly_sync_limit: body.hourlySyncLimit ?? null,
    ai_extraction_enabled: Boolean(body.aiExtractionEnabled),
    ai_cover_letter_enabled: Boolean(body.aiCoverLetterEnabled),
    ai_coaching_enabled: Boolean(body.aiCoachingEnabled),
    updated_by: authResult.adminUserId,
    updated_at: new Date().toISOString(),
  }

  const service = createServiceClient()
  const { data, error } = await service
    .from('tier_config')
    .update(patch)
    .eq('tier', body.tier)
    .select('id,tier,daily_sync_limit,hourly_sync_limit,ai_extraction_enabled,ai_cover_letter_enabled,ai_coaching_enabled,updated_at,updated_by')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await recordAuditEvent({
    userId: authResult.adminUserId,
    eventType: 'admin_tier_config_updated',
    action: 'admin_update_tier_config',
    resourceType: 'tier_config',
    resourceId: body.tier,
    newValues: patch,
  })

  return NextResponse.json({ row: data })
}
