import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

type ProcessedEmailLog = {
  id: string
  gmail_message_id: string
  from_address: string | null
  subject: string | null
  review_status: string | null
  candidate_reason: string | null
  processed_at: string | null
  received_at: string | null
  /** Present when migration `050_processed_emails_envelope.sql` is applied. */
  to_address?: string | null
  cc_address?: string | null
  bcc_address?: string | null
  snippet?: string | null
}

function inferStage(row: ProcessedEmailLog) {
  const reason = (row.candidate_reason || '').toLowerCase()
  const review = (row.review_status || '').toLowerCase()

  if (reason.startsWith('outbound_email')) return 'sync_filter:outbound'
  if (reason.startsWith('gmail_category:')) return 'sync_filter:gmail_category'
  if (reason.startsWith('body_too_large:')) return 'sync_filter:body_size'
  if (reason.startsWith('duplicate_content')) return 'sync_filter:duplicate'
  if (reason.startsWith('sender_reject:') || reason.startsWith('subject_reject:') || reason === 'fast_skip')
    return 'sync_filter:fast_skip'
  if (reason.startsWith('stage1_')) return 'ai_stage1'
  if (reason.startsWith('stage2_')) return 'ai_stage2'
  if (reason.startsWith('stage3_') || reason.startsWith('verifier_')) return 'ai_stage3'
  if (reason.startsWith('unmapped_status:')) return 'ai_status_mapping'
  if (review === 'needs_review') return 'needs_review'
  if (review === 'auto_accepted') return 'upserted_or_updated'
  if (review === 'auto_rejected') return 'auto_rejected'
  return 'unknown'
}

function normalizeDay(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  return value
}

function chunkIds<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

type JobLinkRow = { id: string; title: string; company: string }

const PROCESSED_EMAIL_SELECT_FULL =
  'id,gmail_message_id,from_address,subject,review_status,candidate_reason,processed_at,received_at,to_address,cc_address,bcc_address,snippet'

const PROCESSED_EMAIL_SELECT_FALLBACK =
  'id,gmail_message_id,from_address,subject,review_status,candidate_reason,processed_at,received_at'

function isProcessedEmailsEnvelopeError(err: { message?: string; code?: string } | null) {
  if (!err?.message) return false
  const m = err.message.toLowerCase()
  return (
    err.code === '42703' ||
    (m.includes('column') && (m.includes('does not exist') || m.includes('unknown'))) ||
    m.includes('to_address') ||
    m.includes('cc_address') ||
    m.includes('snippet')
  )
}

function normalizeJobEmbed(raw: unknown): JobLinkRow | null {
  const row = (Array.isArray(raw) ? raw[0] : raw) as { id?: string; title?: string; company?: string } | null
  if (!row?.id) return null
  return {
    id: row.id,
    title: row.title ?? '',
    company: row.company ?? '',
  }
}

async function fetchJobLinksByGmailIds(
  supabase: SupabaseClient,
  gmailMessageIds: string[]
): Promise<Map<string, JobLinkRow>> {
  const map = new Map<string, JobLinkRow>()
  const unique = [...new Set(gmailMessageIds.filter(Boolean))]
  if (unique.length === 0) return map

  const CHUNK = 120
  for (const part of chunkIds(unique, CHUNK)) {
    const { data: rows, error } = await supabase
      .from('job_emails')
      .select('gmail_message_id, jobs(id, title, company)')
      .in('gmail_message_id', part)

    if (error) {
      console.error('[sync/logs] job_emails enrichment:', error.message)
      continue
    }

    for (const row of rows || []) {
      const job = normalizeJobEmbed((row as { jobs?: unknown }).jobs)
      if (job && row.gmail_message_id) {
        map.set(row.gmail_message_id, job)
      }
    }
  }

  return map
}

export async function GET(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const perRunLimitRaw = Number(url.searchParams.get('limit') || 300)
  const perRunLimit = Number.isFinite(perRunLimitRaw)
    ? Math.max(10, Math.min(2000, Math.trunc(perRunLimitRaw)))
    : 300

  const runsListMaxRaw = Number(url.searchParams.get('runsListMax') || 25)
  const runsListMax = Number.isFinite(runsListMaxRaw)
    ? Math.max(10, Math.min(100, Math.trunc(runsListMaxRaw)))
    : 25

  const fetchExtra = runsListMax + 1
  const fromDate = normalizeDay(url.searchParams.get('from'))
  const toDate = normalizeDay(url.searchParams.get('to'))
  const requestedSyncId = url.searchParams.get('syncId')?.trim() || null

  let runListQuery = supabase
    .from('sync_status')
    .select(
      'id,status,total_emails,processed_count,new_jobs_found,error_message,started_at,completed_at,updated_at,extraction_mode,truncated,oldest_processed_at'
    )
    .eq('user_id', user.id)

  if (fromDate) {
    runListQuery = runListQuery.gte('started_at', `${fromDate}T00:00:00.000Z`)
  }
  if (toDate) {
    runListQuery = runListQuery.lte('started_at', `${toDate}T23:59:59.999Z`)
  }

  const { data: runRowsRaw, error: runsError } = await runListQuery
    .order('started_at', { ascending: false })
    .limit(fetchExtra)

  if (runsError) {
    return NextResponse.json({ error: runsError.message }, { status: 500 })
  }

  const allFetched = runRowsRaw || []
  const runsHasMore = allFetched.length > runsListMax
  const runRows = (runsHasMore ? allFetched.slice(0, runsListMax) : allFetched) as Array<{
    id: string
    status: string
    total_emails: number
    processed_count: number
    new_jobs_found: number
    error_message: string | null
    started_at: string | null
    completed_at: string | null
    updated_at: string | null
    extraction_mode: string | null
    truncated: boolean | null
    oldest_processed_at: string | null
  }>

  if (runRows.length === 0) {
    return NextResponse.json({
      runs: [],
      runsHasMore: false,
      runsListMax,
      selectedSyncId: null,
      status: null,
      summary: null,
      emails: [],
      extractionEvents: [],
      syncEvents: [],
    })
  }

  let selectedRow = runRows.find((r) => r.id === requestedSyncId) || null

  if (!selectedRow && requestedSyncId) {
    const { data: byId, error: byIdError } = await supabase
      .from('sync_status')
      .select(
        'id,status,total_emails,processed_count,new_jobs_found,error_message,started_at,completed_at,updated_at,extraction_mode,truncated,oldest_processed_at'
      )
      .eq('user_id', user.id)
      .eq('id', requestedSyncId)
      .maybeSingle()

    if (byIdError) {
      return NextResponse.json({ error: byIdError.message }, { status: 500 })
    }
    if (byId) {
      selectedRow = byId
    }
  }

  if (!selectedRow) {
    selectedRow = runRows[0]
  }

  const latestSync = selectedRow
  const selectedInPage = runRows.some((r) => r.id === latestSync.id)
  const displayRunRows = selectedInPage
    ? runRows
    : [latestSync, ...runRows].slice(0, runsListMax)
  const startedAt = latestSync.started_at || latestSync.updated_at
  const completedAt = latestSync.completed_at || latestSync.updated_at
  const startedMs = startedAt ? Date.parse(startedAt) : Number.NaN
  const completedMs = completedAt ? Date.parse(completedAt) : Number.NaN
  const durationMs =
    Number.isFinite(startedMs) && Number.isFinite(completedMs) && completedMs >= startedMs
      ? completedMs - startedMs
      : null

  let processedEmailsColumns: 'full' | 'legacy' = 'full'
  const processedFull = await supabase
    .from('processed_emails')
    .select(PROCESSED_EMAIL_SELECT_FULL)
    .eq('user_id', user.id)
    .gte('processed_at', startedAt)
    .lte('processed_at', completedAt)
    .order('processed_at', { ascending: false })
    .limit(perRunLimit)

  let processedRows: ProcessedEmailLog[] | null = null
  let processedError = processedFull.error

  if (processedFull.error && isProcessedEmailsEnvelopeError(processedFull.error)) {
    processedEmailsColumns = 'legacy'
    const processedLegacy = await supabase
      .from('processed_emails')
      .select(PROCESSED_EMAIL_SELECT_FALLBACK)
      .eq('user_id', user.id)
      .gte('processed_at', startedAt)
      .lte('processed_at', completedAt)
      .order('processed_at', { ascending: false })
      .limit(perRunLimit)
    processedRows = (processedLegacy.data || []) as ProcessedEmailLog[]
    processedError = processedLegacy.error
  } else {
    processedRows = (processedFull.data || []) as ProcessedEmailLog[]
  }

  const [extractionResult, auditResult] = await Promise.all([
    supabase
      .from('extraction_audit_log')
      .select('id,created_at,status,action,resource_id,pipeline_path')
      .eq('user_id', user.id)
      .gte('created_at', startedAt)
      .lte('created_at', completedAt)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('audit_log')
      .select('id,created_at,event_type,action,resource_id,new_values')
      .eq('user_id', user.id)
      .gte('created_at', startedAt)
      .lte('created_at', completedAt)
      .in('event_type', ['sync_triggered', 'sync_worker_completed', 'sync_worker_failed', 'extraction_failed'])
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  if (processedError) {
    return NextResponse.json(
      {
        error: `processed_emails query failed: ${processedError.message}. Apply migration 050_processed_emails_envelope.sql if columns are missing.`,
      },
      { status: 500 }
    )
  }

  if (extractionResult.error) {
    return NextResponse.json(
      { error: `extraction_audit_log query failed: ${extractionResult.error.message}` },
      { status: 500 }
    )
  }

  if (auditResult.error) {
    return NextResponse.json({ error: `audit_log query failed: ${auditResult.error.message}` }, { status: 500 })
  }

  const extractionRows = extractionResult.data
  const auditRows = auditResult.data

  const gmailIdsForLink = (processedRows || []).map((r) => r.gmail_message_id)
  const jobLinkByGmail = await fetchJobLinksByGmailIds(supabase, gmailIdsForLink)

  const emails = (processedRows || []).map((row) => {
    const link = jobLinkByGmail.get(row.gmail_message_id) ?? null
    return {
      id: row.id,
      gmailMessageId: row.gmail_message_id,
      from: row.from_address,
      subject: row.subject,
      reviewStatus: row.review_status,
      reason: row.candidate_reason,
      stage: inferStage(row),
      processedAt: row.processed_at,
      receivedAt: row.received_at,
      to: row.to_address ?? null,
      cc: row.cc_address ?? null,
      bcc: row.bcc_address ?? null,
      snippet: row.snippet ?? null,
      linkedJob: link ? { id: link.id, title: link.title, company: link.company } : null,
    }
  })

  const runs = displayRunRows.map((r) => ({
    id: r.id,
    status: r.status,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    processed: r.processed_count ?? 0,
    totalEmails: r.total_emails ?? 0,
    newJobsFound: r.new_jobs_found ?? 0,
    failed: r.status === 'failed',
    error: r.error_message,
    extractionMode: r.extraction_mode,
    truncated: r.truncated,
  }))

  return NextResponse.json({
    runs,
    runsHasMore,
    runsListMax,
    selectedSyncId: latestSync.id,
    status: latestSync,
    meta: {
      processedEmailsColumns: processedEmailsColumns,
    },
    summary: {
      startedAt,
      completedAt,
      durationMs,
      durationSeconds: durationMs === null ? null : Math.round(durationMs / 1000),
      processed: latestSync.processed_count || 0,
      created: latestSync.new_jobs_found || 0,
      failed: latestSync.status === 'failed',
      error: latestSync.error_message || null,
      emailsShown: emails.length,
      emailsLinkedToJobs: emails.filter((e) => e.linkedJob !== null).length,
    },
    emails,
    extractionEvents: extractionRows || [],
    syncEvents: auditRows || [],
  })
}
