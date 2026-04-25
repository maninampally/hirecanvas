import { distance } from 'fastest-levenshtein'
import { createServiceClient } from '@/lib/supabase/service'
import { encryptSecret } from '@/lib/security/encryption'
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
  closed: 'Rejected', // DB CHECK constraint only allows the 6 canonical values
}

export function toAppStatus(status: ExtractorStatus | null | undefined): JobStatus | null {
  if (!status) return null
  return EXTRACTOR_TO_APP_STATUS[status] || null
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
  // If either side is null, don't use role as a disqualifier — company match is enough.
  if (!a || !b) return true
  const na = a.toLowerCase().trim()
  const nb = b.toLowerCase().trim()
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
  const supabase = createServiceClient()
  const { userId, extraction, email, body } = params

  const { data: existingJobs } = await supabase
    .from('jobs')
    .select(
      'id,company,title,status,recruiter_name,recruiter_email,interview_date,salary_range,ats_platform,source'
    )
    .eq('user_id', userId)
    // Match against ALL jobs (manual + gmail_sync) so we update manually-added
    // jobs when a matching ATS email arrives, rather than creating a duplicate.
    .in('source', ['gmail_sync', 'manual', 'extension', 'csv_import'])
    .order('updated_at', { ascending: false })
    .limit(300)

  const rows = (existingJobs || []) as JobRow[]
  const matched = rows.find(
    (row) =>
      isSameCompany(row.company, extraction.company) &&
      isSameRole(row.title, extraction.role)
  )

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
      updates.interview_date = extraction.interview_date
    }
    if (!matched.salary_range && extraction.salary_range) {
      updates.salary_range = extraction.salary_range
    }
    if (!matched.ats_platform && extraction.ats_platform) {
      updates.ats_platform = extraction.ats_platform
    }
    if (extraction.ai_confidence_score !== null) {
      updates.ai_confidence_score = extraction.ai_confidence_score
    }
    updates.last_contacted_at = nowIso

    if (Object.keys(updates).length > 1) {
      await supabase.from('jobs').update(updates).eq('id', matched.id).eq('user_id', userId)
    }

    await attachEmail({
      userId,
      jobId: matched.id,
      email,
      body,
      extraction,
    })

    if (statusChanged) {
      await supabase.from('job_status_timeline').insert({
        job_id: matched.id,
        status: extraction.status,
        changed_at: email.receivedAtIso || nowIso,
        notes: `Status advanced from ${matched.status} → ${extraction.status}`,
        ai_confidence_score: extraction.ai_confidence_score,
        requires_review: false,
      })
    }

    return {
      action: statusChanged || Object.keys(updates).length > 1 ? 'updated' : 'noop',
      jobId: matched.id,
      statusChanged,
      previousStatus: matched.status,
      newStatus: statusChanged ? extraction.status : matched.status,
    }
  }

  const insertPayload: Record<string, unknown> = {
    user_id: userId,
    title: (extraction.role || 'Application Update').slice(0, 180),
    company: extraction.company.slice(0, 180),
    status: extraction.status,
    source: 'gmail_sync',
    notes: `Imported from Gmail message ${email.gmailMessageId}`,
    applied_date: (email.receivedAtIso || nowIso).slice(0, 10),
    last_contacted_at: nowIso,
    updated_at: nowIso,
  }

  if (extraction.location) insertPayload.location = extraction.location
  if (extraction.recruiter_name) insertPayload.recruiter_name = extraction.recruiter_name
  if (extraction.recruiter_email) insertPayload.recruiter_email = extraction.recruiter_email
  if (extraction.interview_date) insertPayload.interview_date = extraction.interview_date
  if (extraction.interview_type) insertPayload.interview_type = extraction.interview_type
  if (extraction.salary_range) insertPayload.salary_range = extraction.salary_range
  if (extraction.ats_platform) insertPayload.ats_platform = extraction.ats_platform
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

  await supabase.from('job_status_timeline').insert({
    job_id: created.id,
    status: extraction.status,
    changed_at: email.receivedAtIso || nowIso,
    notes: `Imported from Gmail (${extraction.status})`,
    ai_confidence_score: extraction.ai_confidence_score,
    requires_review: false,
  })

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
  await supabase.from('job_emails').upsert(
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
}) {
  const supabase = createServiceClient()
  await supabase.from('processed_emails').upsert(
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
    },
    { onConflict: 'user_id,gmail_message_id' }
  )
}

export async function markAutoAccepted(params: {
  userId: string
  gmailMessageId: string
  fromAddress: string
  subject: string | null
  contentHash: string | null
  reason: string
  extraction: Record<string, unknown> | null
  receivedAt?: string | null
}) {
  const supabase = createServiceClient()
  await supabase.from('processed_emails').upsert(
    {
      user_id: params.userId,
      gmail_message_id: params.gmailMessageId,
      from_address: params.fromAddress || 'unknown',
      subject: params.subject,
      content_hash: params.contentHash,
      is_job_candidate: true,
      candidate_reason: params.reason,
      review_status: 'auto_accepted',
      borderline_extraction: params.extraction,
    },
    { onConflict: 'user_id,gmail_message_id' }
  )
}

export async function markAutoRejected(params: {
  userId: string
  gmailMessageId: string
  fromAddress: string
  subject: string | null
  contentHash: string | null
  reason: string
  receivedAt?: string | null
}) {
  const supabase = createServiceClient()
  await supabase.from('processed_emails').upsert(
    {
      user_id: params.userId,
      gmail_message_id: params.gmailMessageId,
      from_address: params.fromAddress || 'unknown',
      subject: params.subject,
      content_hash: params.contentHash,
      is_job_candidate: false,
      candidate_reason: params.reason,
      review_status: 'auto_rejected',
    },
    { onConflict: 'user_id,gmail_message_id' }
  )
}
