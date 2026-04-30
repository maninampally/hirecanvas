import { enqueueSyncJob } from '@/lib/queue/syncQueue'
import { acquireSyncLock } from '@/lib/security/syncLock'
import { recordAuditEvent } from '@/lib/security/audit'
import { createServiceClient } from '@/lib/supabase/service'

type EligibleUserRow = {
  id: string
  tier: 'pro' | 'elite' | 'admin'
  auto_sync_time: string | null
}

function getCurrentTimeInFormat(): string {
  const now = new Date()
  const hours = String(now.getUTCHours()).padStart(2, '0')
  const minutes = String(now.getUTCMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

function shouldSyncNow(autoSyncTime: string | null, tier: string): boolean {
  // Pro and admin users always sync (no per-user scheduling)
  if (tier !== 'elite') {
    return true
  }

  // Elite users: only sync if they have a configured time
  if (!autoSyncTime) {
    return false
  }

  // Check if current UTC time matches the configured time
  // Allow a 5-minute window to account for cron job timing variations
  const currentTime = getCurrentTimeInFormat()
  const [currentHour, currentMinute] = currentTime.split(':').map(Number)
  const [syncHour, syncMinute] = autoSyncTime.split(':').map(Number)

  const currentTotalMinutes = currentHour * 60 + currentMinute
  const syncTotalMinutes = syncHour * 60 + syncMinute

  // Allow ±5 minute window
  const diff = Math.abs(currentTotalMinutes - syncTotalMinutes)
  return diff <= 5
}

export async function runDailySyncScheduler() {
  const supabase = createServiceClient()

  const { data: eligibleUsers, error: userError } = await supabase
    .from('app_users')
    .select('id,tier,auto_sync_time')
    .in('tier', ['pro', 'elite', 'admin'])
    .eq('is_suspended', false)

  if (userError) throw userError

  const users = (eligibleUsers || []) as EligibleUserRow[]
  let queued = 0
  let skipped = 0

  for (const user of users) {
    // Check if user should sync at this time
    if (!shouldSyncNow(user.auto_sync_time, user.tier)) {
      skipped += 1
      continue
    }

    const { data: tokenRow, error: tokenError } = await supabase
      .from('oauth_tokens')
      .select('id,is_revoked')
      .eq('user_id', user.id)
      .eq('provider', 'google_gmail')
      .maybeSingle<{ id: string; is_revoked: boolean }>()

    if (tokenError || !tokenRow || tokenRow.is_revoked) {
      skipped += 1
      continue
    }

    const lockAcquired = await acquireSyncLock(user.id)
    if (!lockAcquired) {
      skipped += 1
      continue
    }

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
      skipped += 1
      continue
    }

    await enqueueSyncJob({
      userId: user.id,
      trigger: 'daily_cron',
    })

    await recordAuditEvent({
      userId: user.id,
      eventType: 'sync_scheduled_daily',
      action: 'sync_enqueue',
      resourceType: 'sync',
      newValues: {
        trigger: 'daily_cron',
      },
    })

    queued += 1
  }

  return { queued, skipped, totalEligible: users.length }
}

async function main() {
  const result = await runDailySyncScheduler()
  console.log(
    `[daily-sync-scheduler] queued=${result.queued} skipped=${result.skipped} eligible=${result.totalEligible}`
  )
}

if (require.main === module) {
  void main().catch((error) => {
    console.error(
      '[daily-sync-scheduler] failed:',
      error instanceof Error ? error.message : 'unknown'
    )
    process.exitCode = 1
  })
}
