import { distance } from 'fastest-levenshtein'
import { createServiceClient } from '@/lib/supabase/service'
import { encryptSecret } from '@/lib/security/encryption'
import { withJobUpsertLock } from '@/lib/security/jobUpsertLock'
import type { ExtractorStatus } from '@/lib/extraction/prompts'

export type JobStatus =
  | 'Wishlist'
  | 'Applied'
  | 'Screening'
  | 'Interview'
  | 'Offer'
  | 'Rejected'
  | 'Closed'

// Forward-only status rank. Higher = later in the funnel. Terminal statuses
// share the highest rank so we never regress from e.g. Rejected → Interview.
export const STATUS_RANK: Record<JobStatus, number> = {
  Wishlist: 0,
  Applied: 1,
  Screening: 2,
  Interview: 3,
  Offer: 4,
  Rejected: 5,
  Closed: 5,
}

const EXTRACTOR_TO_APP_STATUS: Record<ExtractorStatus, JobStatus> = {
  applied: 'Applied',
  screening: 'Screening',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  closed: 'Closed',
}

export function toAppStatus(status: ExtractorStatus | null | undefined): JobStatus | null {
  if (!status) return null
  return EXTRACTOR_TO_APP_STATUS[status] || null
}

/**
 * Validate and normalize AI-extracted interview dates to ISO 8601.
 * Returns null for unparseable or clearly bogus values.
 * - Rejects dates more than 2 years in the future (reasonable for multi-round interviews)
 * - Rejects dates before 2020
 * - Only stores date portion, ignoring time (not extracted reliably from emails)
 */
function parseInterviewDate(raw: string | null): string | null {
  if (!raw) return null
  
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  
  const now = Date.now()
  const twoYearsMs = 2 * 365 * 24 * 60 * 60 * 1000
  
  // Reject dates more than 2 years in the future (multi-round interviews)
  if (d.getTime() > now + twoYearsMs) return null
  
  // Reject historical dates (before 2020)
  if (d.getFullYear() < 2020) return null
  
  // Reject past dates (already happened)
  if (d.getTime() < now) return null
  
  // Return date in ISO format (YYYY-MM-DD) to avoid timezone confusion
  // Use UTC date components to ensure consistency
  const year = d.getUTCFullYear()
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  
  return `${year}-${month}-${day}`
}

export function normalizeCompanyNameForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+(inc|llc|corp|ltd|group|resources|technologies|solutions|services)\.?$/i, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isSameCompany(a: string, b: string): boolean {
  if (!a || !b) return false
  const na = normalizeCompanyNameForMatch(a)
  const nb = normalizeCompanyNameForMatch(b)
  if (!na || !nb) return false
  if (na === nb) return true
  // Fuzzy — allow up to 3 character differences for typos/spacing.
  if (distance(na, nb) <= 3) return true
  // One contains the other (e.g. "NextEra" vs "NextEra Energy").
  if (na.includes(nb) || nb.includes(na)) return true
  return false
}

export function isSameRole(a: string | null, b: string | null): boolean {
  const na = (a || '').trim().toLowerCase()
  const nb = (b || '').trim().toLowerCase()
  // Both missing → same “unknown role”; one missing → not the same role for merge purposes.
  if (!na && !nb) return true
  if (!na || !nb) return false
  if (na === nb) return true
  const aWords = na.split(/\s+/).slice(0, 2).join(' ')
  const bWords = nb.split(/\s+/).slice(0, 2).join(' ')
  if (aWords === bWords) return true
  return distance(na, nb) <= 5
}

type JobRow = {
  id: string
  company: string
  title: string | null
  status: JobStatus
  recruiter_name: string | null
  recruiter_email: string | null
  interview_date: string | null
  salary_range: string | null
  ats_platform: string | null
  source: string
}

export type VerifiedExtraction = {
  company: string
  role: string | null
  status: JobStatus
  recruiter_name: string | null
  recruiter_email: string | null
  interview_date: string | null
  interview_type: string | null
  location: string | null
  salary_range: string | null
  application_date: string | null
  ats_platform: string | null
  ai_confidence_score: number | null
}

export type EnvelopeFields = {
  toAddress?: string | null
  ccAddress?: string | null
  bccAddress?: string | null
  snippet?: string | null
}

function envelopeColumns(e: EnvelopeFields) {
  const cols: Record<string, string | null> = {}
  if (e.toAddress != null) cols.to_address = e.toAddress || null
  if (e.ccAddress != null) cols.cc_address = e.ccAddress || null
  if (e.bccAddress != null) cols.bcc_address = e.bccAddress || null
  if (e.snippet != null) cols.snippet = e.snippet || null
  return cols
}

export type EmailRef = {
  gmailMessageId: string
  from: string
  subject: string
  receivedAtIso: string
  snippet: string
  bodyEncrypted?: string | null
  emailDirection?: 'outbound' | 'inbound' | 'unknown'
}

type UpsertOutcome = {
  action: 'created' | 'updated' | 'noop'
  jobId: string
  statusChanged: boolean
  previousStatus?: JobStatus
  newStatus?: JobStatus
}

const JOB_MATCH_PAGE = 500

/**
 * Scan jobs newest-first in pages until a fuzzy match is found or rows are exhausted
 * (avoids silent duplicates when the match is beyond a fixed LIMIT).
 */
async function findMatchingJobRow(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  extraction: VerifiedExtraction
): Promise<JobRow | undefined> {
  const MAX_SCAN_PAGES = 20 // cap at 10k jobs scanned
  let offset = 0
  for (let page = 0; page < MAX_SCAN_PAGES; page++) {
    const { data, error } = await supabase
      .from('jobs')
      .select(
        'id,company,title,status,recruiter_name,recruiter_email,interview_date,salary_range,ats_platform,source'
      )
      .eq('user_id', userId)
      .in('source', ['gmail_sync', 'manual', 'extension', 'csv_import'])
      .order('updated_at', { ascending: false })
      .range(offset, offset + JOB_MATCH_PAGE - 1)

    if (error) {
      throw new Error(`Failed to list jobs for matching: ${error.message}`)
    }

    const chunk = (data || []) as JobRow[]
    if (chunk.length === 0) return undefined

    const matched = chunk.find(
      (row) =>
        isSameCompany(row.company, extraction.company) && isSameRole(row.title, extraction.role)
    )
    if (matched) return matched

    if (chunk.length < JOB_MATCH_PAGE) return undefined
    offset += JOB_MATCH_PAGE
  }

  console.warn('[upsert] Job match scan exceeded page limit for userId:', userId)
  return undefined
}

/**
 * Upsert a job application record with fuzzy company/role matching and
 * forward-only status progression. Always attaches the source email.
 */
export async function upsertJobFromExtraction(params: {
  userId: string
  extraction: VerifiedExtraction
  email: EmailRef
  body?: string | null
}): Promise<UpsertOutcome> {
  return withJobUpsertLock(params.userId, () => upsertJobFromExtractionImpl(params))
}

async function upsertJobFromExtractionImpl(params: {
  userId: string
  extraction: VerifiedExtraction
  email: EmailRef
  body?: string | null
}): Promise<UpsertOutcome> {
  const supabase = createServiceClient()
  const { userId, extraction, email, body } = params

  const matched = await findMatchingJobRow(supabase, userId, extraction)

  const nowIso = new Date().toISOString()

  if (matched) {
    const updates: Record<string, unknown> = { updated_at: nowIso }

    const currentRank = STATUS_RANK[matched.status] ?? 0
    const newRank = STATUS_RANK[extraction.status] ?? 0
    let statusChanged = false
    if (newRank > currentRank && extraction.status !== matched.status) {
      updates.status = extraction.status
      statusChanged = true
    }

    if (!matched.recruiter_name && extraction.recruiter_name) {
      updates.recruiter_name = extraction.recruiter_name
    }
    if (!matched.recruiter_email && extraction.recruiter_email) {
      updates.recruiter_email = extraction.recruiter_email
    }
    if (!matched.interview_date && extraction.interview_date) {
      const validDate = parseInterviewDate(extraction.interview_date)
      if (validDate) updates.interview_date = validDate
    }
    if (!matched.salary_range && extraction.salary_range) {
      updates.salary_range = extraction.salary_range
      const nums = extraction.salary_range.replace(/,/g, '').match(/\d+(\.\d+)?/g)
      if (nums?.length) {
        const vals = nums.map(Number).filter(Number.isFinite)
        if (vals.length) {
          updates.salary_min = Math.min(...vals)
          updates.salary_max = Math.max(...vals)
        }
      }
    }
    if (!matched.ats_platform && extraction.ats_platform) {
      updates.ats_platform = extraction.ats_platform
    }
    if (extraction.ai_confidence_score !== null) {
      updates.ai_confidence_score = extraction.ai_confidence_score
    }
    updates.last_contacted_at = nowIso

    if (Object.keys(updates).length > 1) {
      const { error: updateError } = await supabase
        .from('jobs')
        .update(updates)
        .eq('id', matched.id)
        .eq('user_id', userId)
      if (updateError) {
        throw new Error(`Failed to update job ${matched.id}: ${updateError.message}`)
      }
    }

    await attachEmail({
      userId,
      jobId: matched.id,
      email,
      body,
      extraction,
    })

    if (statusChanged) {
      const { error: timelineError } = await supabase.from('job_status_timeline').insert({
        job_id: matched.id,
        status: extraction.status,
        changed_at: email.receivedAtIso || nowIso,
        notes: `Status advanced from ${matched.status} → ${extraction.status}`,
        ai_confidence_score: extraction.ai_confidence_score,
        requires_review: false,
      })
      if (timelineError) {
        throw new Error(`job_status_timeline insert failed: ${timelineError.message}`)
      }
    }

    return {
      action: statusChanged || Object.keys(updates).length > 1 ? 'updated' : 'noop',
      jobId: matched.id,
      statusChanged,
      previousStatus: matched.status,
      newStatus: statusChanged ? extraction.status : matched.status,
    }
  }

  const appliedYmdFromExtraction = (() => {
    const raw = extraction.application_date?.trim()
    if (!raw) return null
    const m = raw.match(/^(\d{4}-\d{2}-\d{2})/)
    return m ? m[1] : null
  })()

  const insertPayload: Record<string, unknown> = {
    user_id: userId,
    title: (extraction.role || 'Application Update').slice(0, 180),
    company: extraction.company.slice(0, 180),
    status: extraction.status,
    source: 'gmail_sync',
    notes: `Imported from Gmail message ${email.gmailMessageId}`,
    applied_date: appliedYmdFromExtraction ?? (email.receivedAtIso || nowIso).slice(0, 10),
    last_contacted_at: nowIso,
    updated_at: nowIso,
  }

  const notNullStr = (v: string | null | undefined) => v && v !== 'null' && v !== 'undefined' ? v : undefined
  if (notNullStr(extraction.location)) insertPayload.location = extraction.location
  if (notNullStr(extraction.recruiter_name)) insertPayload.recruiter_name = extraction.recruiter_name
  if (notNullStr(extraction.recruiter_email)) insertPayload.recruiter_email = extraction.recruiter_email
  if (notNullStr(extraction.interview_date)) {
    const validDate = parseInterviewDate(extraction.interview_date!)
    if (validDate) insertPayload.interview_date = validDate
  }
  if (notNullStr(extraction.interview_type)) insertPayload.interview_type = extraction.interview_type
  if (notNullStr(extraction.salary_range)) {
    insertPayload.salary_range = extraction.salary_range
    const nums = extraction
      .salary_range!.replace(/,/g, '')
      .match(/\d+(\.\d+)?/g)
    if (nums?.length) {
      const vals = nums.map(Number).filter(Number.isFinite)
      if (vals.length) {
        insertPayload.salary_min = Math.min(...vals)
        insertPayload.salary_max = Math.max(...vals)
      }
    }
  }
  if (notNullStr(extraction.ats_platform)) insertPayload.ats_platform = extraction.ats_platform
  if (extraction.ai_confidence_score !== null)
    insertPayload.ai_confidence_score = extraction.ai_confidence_score

  const { data: created, error: insertError } = await supabase
    .from('jobs')
    .insert(insertPayload)
    .select('id')
    .single<{ id: string }>()

  if (insertError || !created?.id) {
    throw new Error(`Failed to insert job: ${insertError?.message || 'unknown'}`)
  }

  await attachEmail({
    userId,
    jobId: created.id,
    email,
    body,
    extraction,
  })

  const { error: createTimelineError } = await supabase.from('job_status_timeline').insert({
    job_id: created.id,
    status: extraction.status,
    changed_at: email.receivedAtIso || nowIso,
    notes: `Imported from Gmail (${extraction.status})`,
    ai_confidence_score: extraction.ai_confidence_score,
    requires_review: false,
  })
  if (createTimelineError) {
    throw new Error(`job_status_timeline insert failed: ${createTimelineError.message}`)
  }

  return {
    action: 'created',
    jobId: created.id,
    statusChanged: true,
    newStatus: extraction.status,
  }
}

async function attachEmail(params: {
  userId: string
  jobId: string
  email: EmailRef
  body?: string | null
  extraction: VerifiedExtraction
}) {
  const supabase = createServiceClient()
  const { data: existingLink } = await supabase
    .from('job_emails')
    .select('job_id')
    .eq('gmail_message_id', params.email.gmailMessageId)
    .maybeSingle<{ job_id: string }>()

  if (existingLink && existingLink.job_id !== params.jobId) {
    console.warn('[job_emails] gmail_message_id already linked to a different job', {
      gmail_message_id: params.email.gmailMessageId,
      existing_job_id: existingLink.job_id,
      requested_job_id: params.jobId,
    })
  }

  const { error: upsertError } = await supabase.from('job_emails').upsert(
    {
      job_id: params.jobId,
      gmail_message_id: params.email.gmailMessageId,
      from_address: params.email.from || 'unknown',
      email_direction: params.email.emailDirection || 'inbound',
      subject: params.email.subject || '(no subject)',
      snippet: params.email.snippet || null,
      body: params.body ? encryptSecret(params.body) : params.email.bodyEncrypted ?? null,
      received_at: params.email.receivedAtIso,
      extracted_data: {
        company: params.extraction.company,
        role: params.extraction.role,
        status: params.extraction.status,
        recruiter_name: params.extraction.recruiter_name,
        recruiter_email: params.extraction.recruiter_email,
        interview_date: params.extraction.interview_date,
        ats_platform: params.extraction.ats_platform,
        confidence: params.extraction.ai_confidence_score,
      },
    },
    { onConflict: 'gmail_message_id' }
  )
  if (upsertError) {
    throw new Error(`job_emails upsert failed: ${upsertError.message}`)
  }
}

/**
 * Mark a processed_email as needing manual review without committing
 * its extraction to the jobs table.
 */
export async function flagForReview(params: {
  userId: string
  gmailMessageId: string
  fromAddress: string
  subject: string | null
  contentHash: string | null
  reason: string
  extraction: Record<string, unknown> | null
  receivedAt?: string | null
} & EnvelopeFields) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('processed_emails').upsert(
    {
      user_id: params.userId,
      gmail_message_id: params.gmailMessageId,
      from_address: params.fromAddress || 'unknown',
      subject: params.subject,
      content_hash: params.contentHash,
      is_job_candidate: true,
      candidate_reason: params.reason,
      review_status: 'needs_review',
      review_reason: params.reason,
      borderline_extraction: params.extraction,
      ...(params.receivedAt ? { received_at: params.receivedAt } : {}),
      ...envelopeColumns(params),
    },
    { onConflict: 'user_id,gmail_message_id' }
  )
  if (error) throw new Error(`processed_emails upsert (needs_review) failed: ${error.message}`)
}

export async function markAutoAccepted(params: {
  userId: string
  gmailMessageId: string
  gmailThreadId?: string | null
  fromAddress: string
  subject: string | null
  contentHash: string | null
  reason: string
  extraction: Record<string, unknown> | null
  receivedAt?: string | null
} & EnvelopeFields) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('processed_emails').upsert(
    {
      user_id: params.userId,
      gmail_message_id: params.gmailMessageId,
      ...(params.gmailThreadId ? { gmail_thread_id: params.gmailThreadId } : {}),
      from_address: params.fromAddress || 'unknown',
      subject: params.subject,
      content_hash: params.contentHash,
      is_job_candidate: true,
      candidate_reason: params.reason,
      review_status: 'auto_accepted',
      borderline_extraction: params.extraction,
      ...(params.receivedAt ? { received_at: params.receivedAt } : {}),
      ...envelopeColumns(params),
    },
    { onConflict: 'user_id,gmail_message_id' }
  )
  if (error) throw new Error(`processed_emails upsert (auto_accepted) failed: ${error.message}`)
}

export async function markAutoRejected(params: {
  userId: string
  gmailMessageId: string
  gmailThreadId?: string | null
  fromAddress: string
  subject: string | null
  contentHash: string | null
  reason: string
  receivedAt?: string | null
} & EnvelopeFields) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('processed_emails').upsert(
    {
      user_id: params.userId,
      gmail_message_id: params.gmailMessageId,
      ...(params.gmailThreadId ? { gmail_thread_id: params.gmailThreadId } : {}),
      from_address: params.fromAddress || 'unknown',
      subject: params.subject,
      content_hash: params.contentHash,
      is_job_candidate: false,
      candidate_reason: params.reason,
      review_status: 'auto_rejected',
      ...(params.receivedAt ? { received_at: params.receivedAt } : {}),
      ...envelopeColumns(params),
    },
    { onConflict: 'user_id,gmail_message_id' }
  )
  if (error) throw new Error(`processed_emails upsert (auto_rejected) failed: ${error.message}`)
}
