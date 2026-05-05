import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function isMissingRelationError(error: { code?: string; message?: string } | null) {
  if (!error) return false
  return (
    error.code === '42P01' ||
    error.message?.toLowerCase().includes('relation') ||
    error.message?.toLowerCase().includes('does not exist')
  )
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('sync_status')
    .select('id,status,total_emails,processed_count,new_jobs_found,error_message,started_at,completed_at,updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    if (isMissingRelationError(error)) {
      return NextResponse.json({ status: null, warning: 'sync_status_table_missing' }, { status: 200 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data || !data.started_at) {
    return NextResponse.json({ status: data || null })
  }

  // `new_jobs_found` = net-new `jobs` rows from Gmail sync since this run started (PIPE-01).
  const { count: jobsCreatedCount } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('source', 'gmail_sync')
    .gte('created_at', data.started_at)

  const derivedCount = jobsCreatedCount ?? data.new_jobs_found ?? 0

  if (derivedCount !== (data.new_jobs_found ?? 0)) {
    await supabase
      .from('sync_status')
      .update({
        new_jobs_found: derivedCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.id)
  }

  return NextResponse.json({
    status: {
      ...data,
      new_jobs_found: derivedCount,
    },
  })
}
