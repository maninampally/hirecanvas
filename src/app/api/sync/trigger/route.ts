import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enqueueSyncJob } from '@/lib/queue/syncQueue'
import { recordAuditEvent } from '@/lib/security/audit'
import { enforceRateLimit } from '@/lib/security/rateLimit'
import { acquireSyncLock, releaseSyncLock } from '@/lib/security/syncLock'

type AppTier = 'free' | 'pro' | 'elite' | 'admin'

function getSyncLimitForTier(tier: AppTier) {
  if (tier === 'pro') {
    return {
      key: 'sync_daily',
      limit: 3,
      windowInSeconds: 24 * 60 * 60,
      label: 'day',
    }
  }

  if (tier === 'admin') {
    return {
      key: 'sync_hourly',
      limit: 60,
      windowInSeconds: 60 * 60,
      label: 'hour',
    }
  }

  return {
    key: 'sync_hourly',
    limit: 30,
    windowInSeconds: 60 * 60,
    label: 'hour',
  }
}

export async function POST() {
  const requestMeta = {
    ipAddress: null as string | null,
    userAgent: null as string | null,
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  requestMeta.userAgent = null

  const { data: appUser, error: appUserError } = await supabase
    .from('app_users')
    .select('tier,is_suspended')
    .eq('id', user.id)
    .single()

  if (appUserError || !appUser) {
    return NextResponse.json({ error: 'Unable to read user profile' }, { status: 400 })
  }

  const tier = (appUser.tier || 'free') as AppTier

  if (appUser.is_suspended) {
    await recordAuditEvent({
      userId: user.id,
      eventType: 'sync_denied_suspended',
      action: 'sync_trigger',
      resourceType: 'sync',
      newValues: { reason: 'account_suspended' },
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    })

    return NextResponse.json({ error: 'Account suspended' }, { status: 403 })
  }

  if (tier === 'free') {
    await recordAuditEvent({
      userId: user.id,
      eventType: 'sync_denied_tier',
      action: 'sync_trigger',
      resourceType: 'sync',
      newValues: { tier },
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    })

    return NextResponse.json(
      { error: 'Upgrade required. Auto-sync is available on Pro and Elite plans.' },
      { status: 403 }
    )
  }

  const { count: oauthTokenCount, error: oauthError } = await supabase
    .from('oauth_tokens')
    .select('id', { head: true, count: 'exact' })
    .eq('user_id', user.id)
    .eq('provider', 'google_gmail')
    .eq('is_revoked', false)

  if (oauthError || !oauthTokenCount || oauthTokenCount === 0) {
    await recordAuditEvent({
      userId: user.id,
      eventType: 'sync_denied_oauth_missing',
      action: 'sync_trigger',
      resourceType: 'oauth_tokens',
      newValues: { provider: 'google_gmail' },
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    })

    return NextResponse.json(
      { error: 'Gmail is not connected. Please connect Gmail from Settings.' },
      { status: 400 }
    )
  }

  const limitConfig = getSyncLimitForTier(tier)
  const rateLimitResult = await enforceRateLimit(
    user.id,
    limitConfig.key,
    limitConfig.limit,
    limitConfig.windowInSeconds
  )

  if (!rateLimitResult.allowed) {
    await recordAuditEvent({
      userId: user.id,
      eventType: 'sync_rate_limited',
      action: 'sync_trigger',
      resourceType: 'sync',
      newValues: {
        limitKey: limitConfig.key,
        limit: limitConfig.limit,
        resetInSeconds: rateLimitResult.resetInSeconds,
      },
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    })

    return NextResponse.json(
      {
        error: `Sync limit reached for this ${limitConfig.label}.`,
        remaining: 0,
        resetInSeconds: rateLimitResult.resetInSeconds,
      },
      { status: 429 }
    )
  }

  const lockAcquired = await acquireSyncLock(user.id)
  if (!lockAcquired) {
    await recordAuditEvent({
      userId: user.id,
      eventType: 'sync_lock_conflict',
      action: 'sync_trigger',
      resourceType: 'sync',
      newValues: { reason: 'concurrent_sync' },
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    })

    return NextResponse.json(
      { error: 'A sync is already in progress. Please wait a few minutes.' },
      { status: 409 }
    )
  }

  try {
    const { error: syncStatusError } = await supabase.from('sync_status').insert({
      user_id: user.id,
      status: 'in_progress',
      total_emails: 0,
      processed_count: 0,
      new_jobs_found: 0,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    if (syncStatusError) {
      throw syncStatusError
    }

    const job = await enqueueSyncJob({
      userId: user.id,
      trigger: 'manual',
    })

    await recordAuditEvent({
      userId: user.id,
      eventType: 'sync_triggered',
      action: 'sync_enqueue',
      resourceType: 'sync_status',
      resourceId: String(job.id || ''),
      newValues: {
        tier,
        remaining: rateLimitResult.remaining,
      },
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    })

    return NextResponse.json(
      {
        message: 'Sync started',
        jobId: job.id,
        remaining: rateLimitResult.remaining,
        resetInSeconds: rateLimitResult.resetInSeconds,
      },
      { status: 200 }
    )
  } catch (error) {
    await releaseSyncLock(user.id)

    await recordAuditEvent({
      userId: user.id,
      eventType: 'sync_trigger_failed',
      action: 'sync_trigger',
      resourceType: 'sync',
      newValues: { error: error instanceof Error ? error.message : 'unknown' },
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    })

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to start sync',
      },
      { status: 500 }
    )
  }
}
