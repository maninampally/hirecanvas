import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

type BillingEventRow = {
  user_id: string | null
  event_type: string
  amount_cents: number | null
  status: string | null
  stripe_subscription_id: string | null
  created_at: string
}

function isMissingRelationError(error: { code?: string; message?: string } | null) {
  if (!error) return false
  return error.code === '42P01' || error.message?.toLowerCase().includes('relation') || error.message?.toLowerCase().includes('does not exist')
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: appUser } = await supabase
    .from('app_users')
    .select('tier')
    .eq('id', user.id)
    .single<{ tier: 'free' | 'pro' | 'elite' | 'admin' }>()

  if (!appUser || appUser.tier !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = createServiceClient()

  const [
    usersCount,
    proCount,
    eliteCount,
    activeSyncCount,
    aiUsageRows,
    billingEventRows,
    recentAuditRows,
    recentSyncRows,
  ] = await Promise.all([
    service.from('app_users').select('id', { count: 'exact', head: true }),
    service.from('app_users').select('id', { count: 'exact', head: true }).eq('tier', 'pro'),
    service.from('app_users').select('id', { count: 'exact', head: true }).eq('tier', 'elite'),
    service
      .from('sync_status')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'in_progress'),
    service.from('ai_usage').select('feature,tokens_used,cost_cents').limit(500),
    service.from('billing_events').select('user_id,event_type,amount_cents,status,stripe_subscription_id,created_at').limit(2000),
    service
      .from('audit_log')
      .select('id,event_type,action,user_id,created_at')
      .order('created_at', { ascending: false })
      .limit(8),
    service
      .from('sync_status')
      .select('id,user_id,status,processed_count,total_emails,new_jobs_found,updated_at')
      .order('updated_at', { ascending: false })
      .limit(8),
  ])

  const usageRows = aiUsageRows.data || []
  const totalAiCostCents = usageRows.reduce((sum, row) => sum + (row.cost_cents || 0), 0)
  const totalAiTokens = usageRows.reduce((sum, row) => sum + (row.tokens_used || 0), 0)
  const aiUsageByFeature = usageRows.reduce<Record<string, { count: number; cost_cents: number; tokens: number }>>(
    (acc, row) => {
      const feature = row.feature || 'unknown'
      if (!acc[feature]) {
        acc[feature] = { count: 0, cost_cents: 0, tokens: 0 }
      }
      acc[feature].count += 1
      acc[feature].cost_cents += row.cost_cents || 0
      acc[feature].tokens += row.tokens_used || 0
      return acc
    },
    {}
  )
  const avgCostPerExtractionCents = aiUsageByFeature.email_extraction?.count
    ? Number((aiUsageByFeature.email_extraction.cost_cents / aiUsageByFeature.email_extraction.count).toFixed(4))
    : 0

  const events = (!billingEventRows.error || isMissingRelationError(billingEventRows.error)
    ? billingEventRows.data || []
    : []) as BillingEventRow[]

  const activeSubscriptions = new Map<string, BillingEventRow>()
  const firstCreatedAtBySubscription = new Map<string, number>()

  for (const event of events) {
    const subscriptionId = event.stripe_subscription_id
    if (subscriptionId) {
      const eventTs = new Date(event.created_at).getTime()
      const firstSeen = firstCreatedAtBySubscription.get(subscriptionId)
      if (!firstSeen || eventTs < firstSeen) {
        firstCreatedAtBySubscription.set(subscriptionId, eventTs)
      }

      if (event.event_type === 'customer.subscription.deleted' || event.status === 'canceled' || event.status === 'incomplete_expired') {
        activeSubscriptions.delete(subscriptionId)
      } else if (event.event_type === 'customer.subscription.updated' || event.event_type === 'checkout.session.completed') {
        activeSubscriptions.set(subscriptionId, event)
      }
    }
  }

  let mrrCents = 0
  for (const activeEvent of activeSubscriptions.values()) {
    mrrCents += activeEvent.amount_cents || 0
  }

  const totalStartedSubs = firstCreatedAtBySubscription.size
  const activeSubs = activeSubscriptions.size
  const churnRatePercent = totalStartedSubs > 0
    ? Number((((totalStartedSubs - activeSubs) / totalStartedSubs) * 100).toFixed(2))
    : 0

  const avgRevenuePerUserCents = activeSubs > 0 ? Math.round(mrrCents / activeSubs) : 0
  const subscriptionAgesInMonths = [...firstCreatedAtBySubscription.values()].map((ts) => {
    const now = Date.now()
    const months = (now - ts) / (1000 * 60 * 60 * 24 * 30)
    return Math.max(0, months)
  })
  const avgSubscriptionDurationMonths = subscriptionAgesInMonths.length > 0
    ? subscriptionAgesInMonths.reduce((sum, value) => sum + value, 0) / subscriptionAgesInMonths.length
    : 0
  const ltvCents = Math.round(avgRevenuePerUserCents * avgSubscriptionDurationMonths)

  const infraEstimateCents = Number(process.env.MONTHLY_INFRA_ESTIMATE_CENTS || '5000')
  const netMarginPercent = mrrCents > 0
    ? Number((((mrrCents - totalAiCostCents - infraEstimateCents) / mrrCents) * 100).toFixed(2))
    : 0

  return NextResponse.json({
    metrics: {
      totalUsers: usersCount.count || 0,
      proUsers: proCount.count || 0,
      eliteUsers: eliteCount.count || 0,
      activeSyncJobs: activeSyncCount.count || 0,
      totalAiCostCents,
      totalAiTokens,
      mrrCents,
      activeSubscriptions: activeSubs,
      churnRatePercent,
      ltvCents,
      infraEstimateCents,
      netMarginPercent,
      avgCostPerExtractionCents,
    },
    aiUsageByFeature,
    recentAudit: recentAuditRows.data || [],
    recentSync: recentSyncRows.data || [],
  })
}
