import { runWithLLMRouter } from '@/lib/ai/llmRouter'
import { sendTransactionalEmail } from '@/lib/email/ses'
import { getRedisClient } from '@/lib/redis'
import { type NudgeJobPayload } from '@/lib/queue/nudgeQueue'
import { createServiceClient } from '@/lib/supabase/service'

type OpenJob = {
  id: string
  user_id: string
  title: string
  company: string
  status: 'Wishlist' | 'Applied' | 'Screening' | 'Interview' | 'Offer' | 'Rejected'
  last_contacted_at: string | null
  updated_at: string
}

type PreferenceRow = {
  user_id: string
  follow_up_nudges: boolean
  unsubscribe_token: string
}

type AppUserRow = {
  id: string
  email: string
  full_name: string | null
}

function getDaysSince(dateLike: string) {
  const ms = Date.now() - new Date(dateLike).getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

function getThreshold(daysSince: number) {
  if (daysSince >= 21) return 21
  if (daysSince >= 14) return 14
  if (daysSince >= 7) return 7
  return null
}

async function generateFollowUpDraft(job: OpenJob, daysStale: number) {
  const prompt = [
    'Write a concise and professional follow-up email draft for a job application.',
    'Return plain text only with greeting, body, and sign-off.',
    `Company: ${job.company}`,
    `Role: ${job.title}`,
    `Current status: ${job.status}`,
    `Days since last update: ${daysStale}`,
  ].join('\n')

  const result = await runWithLLMRouter({
    task: 'general',
    systemPrompt:
      'You are a precise career assistant. Generate a short, polite follow-up email in under 130 words.',
    prompt,
    temperature: 0.4,
    maxTokens: 350,
  })

  return result
}

function renderNudgeHtml(params: {
  fullName: string
  job: OpenJob
  daysStale: number
  draft: string
  unsubscribeUrl: string
}) {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
      <h2 style="margin-bottom: 12px;">Follow-up nudge for ${params.job.company}</h2>
      <p>Hi ${params.fullName},</p>
      <p>
        Your ${params.job.title} application has been quiet for ${params.daysStale} days.
        Here is a ready-to-send follow-up draft:
      </p>
      <pre style="white-space: pre-wrap; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px;">${params.draft}</pre>
      <p style="margin-top: 16px;">You can edit and send this from your outreach workflow.</p>
      <p style="font-size: 12px; color: #64748b; margin-top: 18px;">
        To unsubscribe from email nudges, click
        <a href="${params.unsubscribeUrl}">unsubscribe</a>.
      </p>
    </div>
  `
}

async function getTargetUsers(payload: NudgeJobPayload) {
  const supabase = createServiceClient()

  let prefQuery = supabase
    .from('notification_preferences')
    .select('user_id,follow_up_nudges,unsubscribe_token')
    .eq('follow_up_nudges', true)

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

export async function processNudgeJob(payload: NudgeJobPayload) {
  const supabase = createServiceClient()
  const redis = getRedisClient()
  await redis.connect().catch(() => undefined)

  const targets = await getTargetUsers(payload)

  for (const target of targets) {
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('id,user_id,title,company,status,last_contacted_at,updated_at')
      .eq('user_id', target.user.id)
      .in('status', ['Applied', 'Screening', 'Interview'])

    if (jobsError) throw jobsError

    const openJobs = (jobs || []) as OpenJob[]

    for (const job of openJobs) {
      const lastTouch = job.last_contacted_at || job.updated_at
      const daysStale = getDaysSince(lastTouch)
      const threshold = getThreshold(daysStale)

      if (!threshold) continue

      const dedupeKey = `nudge:sent:${target.user.id}:${job.id}:${threshold}`
      const acquired = await redis.set(dedupeKey, '1', 'EX', 2592000, 'NX')
      if (!acquired) continue

      const aiResult = await generateFollowUpDraft(job, daysStale)
      const unsubscribeUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/unsubscribe?token=${target.preference.unsubscribe_token}`

      const subject = `Follow-up suggestion: ${job.company} (${daysStale}d idle)`
      const html = renderNudgeHtml({
        fullName: target.user.full_name || 'there',
        job,
        daysStale,
        draft: aiResult.text,
        unsubscribeUrl,
      })

      const emailResult = await sendTransactionalEmail({
        to: target.user.email,
        subject,
        html,
        text: aiResult.text,
      })

      await supabase.from('notifications').insert({
        user_id: target.user.id,
        type: 'follow_up_nudge',
        title: subject,
        message: `Threshold ${threshold}d reached for ${job.title} at ${job.company}`,
        action_url: '/outreach',
      })

      await supabase.from('ai_usage').insert({
        user_id: target.user.id,
        feature: 'follow_up_nudge_draft',
        tokens_used: Math.max(60, Math.ceil(aiResult.text.length / 4)),
        cost_cents: emailResult.dryRun ? 1 : 2,
        status: 'completed',
      })
    }
  }
}
