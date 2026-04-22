import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { runDailySyncScheduler } from '@/lib/sync/runDailySyncScheduler'
import { recordAuditEvent } from '@/lib/security/audit'

function isAuthorizedCronRequest(request: NextRequest) {
  const configuredSecret = process.env.SYNC_CRON_SECRET
  const providedSecret = request.headers.get('x-cron-secret')

  if (!configuredSecret || !providedSecret) return false

  const configured = Buffer.from(configuredSecret)
  const provided = Buffer.from(providedSecret)
  if (configured.length !== provided.length) return false

  return timingSafeEqual(configured, provided)
}

export async function POST(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    await recordAuditEvent({
      eventType: 'sync_schedule_denied',
      action: 'sync_schedule_daily',
      resourceType: 'sync',
      newValues: { reason: 'invalid_or_missing_cron_secret' },
    })

    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runDailySyncScheduler()

    await recordAuditEvent({
      eventType: 'sync_schedule_executed',
      action: 'sync_schedule_daily',
      resourceType: 'sync',
      newValues: result,
    })

    return NextResponse.json({ ok: true, ...result }, { status: 200 })
  } catch (error) {
    await recordAuditEvent({
      eventType: 'sync_schedule_failed',
      action: 'sync_schedule_daily',
      resourceType: 'sync',
      newValues: { error: error instanceof Error ? error.message : 'unknown' },
    })

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Scheduler failed' },
      { status: 500 }
    )
  }
}
