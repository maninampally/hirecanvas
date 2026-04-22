import { enqueueSyncJob } from '@/lib/queue/syncQueue'
import { acquireSyncLock } from '@/lib/security/syncLock'
import { recordAuditEvent } from '@/lib/security/audit'
import { createServiceClient } from '@/lib/supabase/service'

type EligibleUserRow = {
  id: string
  tier: 'pro' | 'elite' | 'admin'
}

export async function runDailySyncScheduler() {
  const supabase = createServiceClient()

  const { data: eligibleUsers, error: userError } = await supabase
    .from('app_users')
    .select('id,tier')
    .in('tier', ['pro', 'elite', 'admin'])
    .eq('is_suspended', false)

  if (userError) throw userError

  const users = (eligibleUsers || []) as EligibleUserRow[]
  let queued = 0
  let skipped = 0

  for (const user of users) {
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
