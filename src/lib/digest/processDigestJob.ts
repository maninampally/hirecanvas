import { sendTransactionalEmail } from '@/lib/email/ses'
import { type DigestJobPayload } from '@/lib/queue/digestQueue'
import { createServiceClient } from '@/lib/supabase/service'

type PreferenceRow = {
  user_id: string
  daily_digest: boolean
  unsubscribe_token: string
}

type AppUserRow = {
  id: string
  email: string
  full_name: string | null
}

type DigestStats = {
  newJobs: number
  interviews: number
  staleApplied: number
  pendingReminders: number
}

async function getTargetUsers(payload: DigestJobPayload) {
  const supabase = createServiceClient()

  let prefQuery = supabase
    .from('notification_preferences')
    .select('user_id,daily_digest,unsubscribe_token')
    .eq('daily_digest', true)

  if (payload.userId) {
    prefQuery = prefQuery.eq('user_id', payload.userId)
  }

  const { data: preferences, error: preferenceError } = await prefQuery

  if (preferenceError) throw preferenceError

  const prefRows = (preferences || []) as PreferenceRow[]
  if (!prefRows.length) return []

  const userIds = prefRows.map((row) => row.user_id)

  const { data: users, error: usersError } = await supabase
    .from('app_users')
    .select('id,email,full_name')
    .in('id', userIds)

  if (usersError) throw usersError

  const userRows = (users || []) as AppUserRow[]

  return prefRows
    .map((pref) => {
      const user = userRows.find((item) => item.id === pref.user_id)
      if (!user?.email) return null
      return {
        user,
        preference: pref,
      }
    })
    .filter((item): item is { user: AppUserRow; preference: PreferenceRow } => Boolean(item))
}

async function getDigestStats(userId: string): Promise<DigestStats> {
  const supabase = createServiceClient()

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const soonDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [{ count: newJobs }, { count: interviews }, { count: staleApplied }, { count: pendingReminders }] =
    await Promise.all([
      supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', yesterday),
      supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'Interview'),
      supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('status', ['Applied', 'Screening'])
        .lt('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      supabase
        .from('reminders')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('completed_at', null)
        .lte('due_date', soonDate),
    ])

  return {
    newJobs: newJobs || 0,
    interviews: interviews || 0,
    staleApplied: staleApplied || 0,
    pendingReminders: pendingReminders || 0,
  }
}

function renderDigestHtml(params: {
  fullName: string
  stats: DigestStats
  unsubscribeUrl: string
}) {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
      <h2 style="margin-bottom: 10px;">Your HireCanvas daily digest</h2>
      <p>Good morning ${params.fullName}, here is your quick snapshot:</p>
      <ul>
        <li><strong>${params.stats.newJobs}</strong> new applications in the last 24h</li>
        <li><strong>${params.stats.interviews}</strong> active interview-stage applications</li>
        <li><strong>${params.stats.staleApplied}</strong> applications need a follow-up</li>
        <li><strong>${params.stats.pendingReminders}</strong> reminders due in the next 3 days</li>
      </ul>
      <p style="margin-top: 14px;">Open HireCanvas to review updates and keep momentum.</p>
      <p style="font-size: 12px; color: #64748b; margin-top: 16px;">
        Want fewer emails? You can
        <a href="${params.unsubscribeUrl}">unsubscribe</a>
        anytime.
      </p>
    </div>
  `
}

export async function processDigestJob(payload: DigestJobPayload) {
  const supabase = createServiceClient()

  const targets = await getTargetUsers(payload)

  for (const target of targets) {
    const stats = await getDigestStats(target.user.id)

    const unsubscribeUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/unsubscribe?token=${target.preference.unsubscribe_token}`

    const emailResult = await sendTransactionalEmail({
      to: target.user.email,
      subject: 'Your HireCanvas daily digest',
      html: renderDigestHtml({
        fullName: target.user.full_name || 'there',
        stats,
        unsubscribeUrl,
      }),
      text: `Daily digest: ${stats.newJobs} new jobs, ${stats.interviews} interviews, ${stats.staleApplied} stale, ${stats.pendingReminders} reminders due.`,
    })

    await supabase.from('notifications').insert({
      user_id: target.user.id,
      type: 'daily_digest',
      title: 'Daily digest sent',
      message: `New: ${stats.newJobs}, Interviews: ${stats.interviews}, Follow-ups: ${stats.staleApplied}`,
      action_url: '/',
    })

    await supabase.from('ai_usage').insert({
      user_id: target.user.id,
      feature: 'daily_digest_email',
      tokens_used: 30,
      cost_cents: emailResult.dryRun ? 0 : 1,
      status: 'completed',
    })
  }

  // Keep only the 10 most recent sync_status rows per user — prevents unbounded growth
  // (3 syncs/day × 365 days = 1,095 rows/user/year without this)
  await supabase.rpc('cleanup_old_sync_status')
}
