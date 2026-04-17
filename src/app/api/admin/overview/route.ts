import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

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
    service.from('ai_usage').select('tokens_used,cost_cents').limit(500),
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

  return NextResponse.json({
    metrics: {
      totalUsers: usersCount.count || 0,
      proUsers: proCount.count || 0,
      eliteUsers: eliteCount.count || 0,
      activeSyncJobs: activeSyncCount.count || 0,
      totalAiCostCents,
      totalAiTokens,
    },
    recentAudit: recentAuditRows.data || [],
    recentSync: recentSyncRows.data || [],
  })
}
