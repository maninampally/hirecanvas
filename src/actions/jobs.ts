'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { decryptOrReturnPlainText } from '@/lib/security/encryption'
import { jobSchema, JobFormData } from '@/lib/validations/jobs'
import { sanitizeSearchInput, isMissingRelationError } from '@/lib/utils'
import { updateStreakOnJobActivity } from '@/actions/dashboard'

type JobStatus = 'Wishlist' | 'Applied' | 'Screening' | 'Interview' | 'Offer' | 'Rejected'

type CSVExportFilters = {
  status?: string
  statuses?: string[]
  search?: string
  appliedFrom?: string
  appliedTo?: string
  salaryMin?: number
  salaryMax?: number
  includeArchived?: boolean
}

type CSVImportRow = Partial<JobFormData>

export type JobTimelineEntry = {
  id: string
  status: 'Wishlist' | 'Applied' | 'Screening' | 'Interview' | 'Offer' | 'Rejected'
  changed_at: string
  notes: string | null
  ai_confidence_score: number | null
  requires_review: boolean
}

export type JobEmailEntry = {
  id: string
  gmail_message_id: string
  from_address: string
  email_direction: 'outbound' | 'inbound' | 'unknown'
  subject: string
  body: string | null
  snippet: string | null
  received_at: string
  is_read: boolean
  extracted_data: {
    source?: string
    inferredStatus?: string | null
    providerHint?: string
    model?: string
    fallbackCount?: number
    extracted?: {
      confidence?: number | null
      notes?: string | null
    }
  } | null
}

// isMissingRelationError is now imported from @/lib/utils

function normalizeStatus(rawStatus?: string | null): JobStatus {
  const normalized = (rawStatus || '').trim().toLowerCase()

  if (normalized === 'wishlist') return 'Wishlist'
  if (normalized === 'applied') return 'Applied'
  if (normalized === 'screening' || normalized === 'screen') return 'Screening'
  if (normalized === 'interview' || normalized === 'interviews') return 'Interview'
  if (normalized === 'offer' || normalized === 'offered') return 'Offer'
  if (normalized === 'rejected' || normalized === 'reject') return 'Rejected'

  return 'Applied'
}

function cleanOptional(value?: string | null) {
  const cleaned = value?.trim()
  return cleaned ? cleaned : undefined
}

function escapeCsv(value?: string | null) {
  const cell = value ?? ''
  const escaped = cell.replaceAll('"', '""')
  return `"${escaped}"`
}

function parseSalaryToNumber(value?: string | null) {
  if (!value) return null
  const normalized = value.replace(/,/g, '')
  const matches = normalized.match(/\d+(\.\d+)?/g)
  if (!matches || matches.length === 0) return null
  const numeric = matches.map((item) => Number(item)).filter((item) => Number.isFinite(item))
  if (numeric.length === 0) return null
  return Math.max(...numeric)
}

function parseSalaryRange(value?: string | null) {
  if (!value) return { salary_min: null as number | null, salary_max: null as number | null }
  const normalized = value.replace(/,/g, '')
  const matches = normalized.match(/\d+(\.\d+)?/g)
  if (!matches || matches.length === 0) return { salary_min: null as number | null, salary_max: null as number | null }
  const numeric = matches.map((item) => Number(item)).filter((item) => Number.isFinite(item))
  if (numeric.length === 0) return { salary_min: null as number | null, salary_max: null as number | null }
  const min = Math.min(...numeric)
  const max = Math.max(...numeric)
  return { salary_min: min, salary_max: max }
}

function formatSalaryDisplay(row: Record<string, unknown>) {
  const salary = typeof row.salary === 'string' ? row.salary : null
  if (salary) return salary
  const min = typeof row.salary_min === 'number' ? row.salary_min : null
  const max = typeof row.salary_max === 'number' ? row.salary_max : null
  const currency = typeof row.currency === 'string' ? row.currency : 'USD'
  if (min !== null && max !== null) return `${currency} ${min.toLocaleString()} - ${max.toLocaleString()}`
  if (max !== null) return `${currency} ${max.toLocaleString()}`
  if (min !== null) return `${currency} ${min.toLocaleString()}`
  return undefined
}

/** PostgREST: plain gte/lte on applied_date hides NULLs; include undated jobs so list matches user expectations. */
function withAppliedDateOrNull<
  T extends { or: (s: string) => T },
>(query: T, filters?: { appliedFrom?: string; appliedTo?: string }): T {
  const from = filters?.appliedFrom?.trim()
  const to = filters?.appliedTo?.trim()
  if (from && to) {
    return query.or(`applied_date.is.null,and(applied_date.gte.${from},applied_date.lte.${to})`)
  }
  if (from) {
    return query.or(`applied_date.is.null,applied_date.gte.${from}`)
  }
  if (to) {
    return query.or(`applied_date.is.null,applied_date.lte.${to}`)
  }
  return query
}

async function ensureAppUserExists(user: { id: string; user_metadata?: Record<string, unknown> | null }) {
  const service = createServiceClient()
  const fullNameRaw = user.user_metadata?.full_name
  const fullName = typeof fullNameRaw === 'string' ? fullNameRaw : ''

  const { error } = await service.from('app_users').upsert(
    {
      id: user.id,
      full_name: fullName,
      tier: 'free',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  )

  if (error) {
    throw error
  }
}

export async function createJob(data: JobFormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')
  await ensureAppUserExists(user)

  const validated = jobSchema.parse(data)
  const salaryRange = parseSalaryRange(validated.salary)

  const { error, data: job } = await supabase
    .from('jobs')
    .insert({
      title: validated.title,
      company: validated.company,
      location: validated.location,
      status: validated.status,
      url: validated.url || null,
      notes: validated.notes,
      ...salaryRange,
      user_id: user.id,
      source: 'manual',
      is_archived: false,
      applied_date: validated.applied_date ? new Date(validated.applied_date) : null,
    })
    .select()
    .single()

  if (error) {
    if (isMissingRelationError(error)) {
      throw new Error('Jobs table is not available yet. Please run the latest database migrations.')
    }
    throw error
  }
  await updateStreakOnJobActivity(user.id)
  return job
}

export async function updateJob(id: string, data: Partial<JobFormData>) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const salaryRange =
    typeof data.salary === 'string' ? parseSalaryRange(data.salary) : { salary_min: undefined, salary_max: undefined }
  const { error, data: job } = await supabase
    .from('jobs')
    .update({
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.company !== undefined ? { company: data.company } : {}),
      ...(data.location !== undefined ? { location: data.location } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.url !== undefined ? { url: data.url || null } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.salary !== undefined ? salaryRange : {}),
      applied_date: data.applied_date ? new Date(data.applied_date) : null,
      updated_at: new Date(),
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    if (isMissingRelationError(error)) {
      throw new Error('Jobs table is not available yet. Please run the latest database migrations.')
    }
    throw error
  }
  await updateStreakOnJobActivity(user.id)
  return job
}

export async function deleteJob(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('jobs')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    if (isMissingRelationError(error)) {
      throw new Error('Jobs table is not available yet. Please run the latest database migrations.')
    }
    throw error
  }
}

export async function getJobs(
  filters?: {
    status?: string
    statuses?: string[]
    search?: string
    appliedFrom?: string
    appliedTo?: string
    salaryMin?: number
    salaryMax?: number
    includeArchived?: boolean
  }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  let query = supabase
    .from('jobs')
    .select(
      `
      *,
      job_resumes (count)
    `
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (!filters?.includeArchived) {
    query = query.eq('is_archived', false)
  }

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }
  if (filters?.statuses && filters.statuses.length > 0) {
    query = query.in('status', filters.statuses)
  }

  if (filters?.search) {
    const searchValue = sanitizeSearchInput(filters.search)
    if (searchValue) query = query.or(`title.ilike.%${searchValue}%,company.ilike.%${searchValue}%`)
  }
  query = withAppliedDateOrNull(query, filters)

  const { error, data } = await query

  if (error) {
    if (isMissingRelationError(error)) {
      return []
    }

    // e.g. job_resumes embed unavailable — fall back to plain job rows
    let fq = supabase
      .from('jobs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (!filters?.includeArchived) {
      fq = fq.eq('is_archived', false)
    }
    if (filters?.status) {
      fq = fq.eq('status', filters.status)
    }
    if (filters?.statuses && filters.statuses.length > 0) {
      fq = fq.in('status', filters.statuses)
    }
    if (filters?.search) {
      const sv = sanitizeSearchInput(filters.search)
      if (sv) fq = fq.or(`title.ilike.%${sv}%,company.ilike.%${sv}%`)
    }
    fq = withAppliedDateOrNull(fq, filters)

    const fb = await fq
    if (fb.error) {
      if (isMissingRelationError(fb.error)) {
        return []
      }
      throw fb.error
    }
    let fallbackRows = (fb.data || []).map((row) => ({
      ...row,
      salary: formatSalaryDisplay(row as Record<string, unknown>),
      resume_count: 0,
    }))
    if (typeof filters?.salaryMin === 'number' || typeof filters?.salaryMax === 'number') {
      fallbackRows = fallbackRows.filter((row) => {
        const salary =
          parseSalaryToNumber(typeof row.salary === 'string' ? row.salary : null) ??
          (typeof row.salary_max === 'number' ? row.salary_max : null)
        if (salary === null) return false
        if (typeof filters?.salaryMin === 'number' && salary < filters.salaryMin) return false
        if (typeof filters?.salaryMax === 'number' && salary > filters.salaryMax) return false
        return true
      })
    }
    return fallbackRows
  }

  type RowWithResumes = (typeof data)[number] & {
    job_resumes?: { count: number }[] | null
  }

  let rows = (data || []).map((row: RowWithResumes) => {
    const jr = row.job_resumes
    const count =
      Array.isArray(jr) && jr[0] != null && typeof jr[0].count === 'number'
        ? Number(jr[0].count)
        : 0
    const job = { ...row }
    delete (job as { job_resumes?: unknown }).job_resumes
    return {
      ...job,
      salary: formatSalaryDisplay(job as Record<string, unknown>),
      resume_count: count,
    }
  })

  if (typeof filters?.salaryMin === 'number' || typeof filters?.salaryMax === 'number') {
    rows = rows.filter((row) => {
      const salary =
        parseSalaryToNumber(typeof row.salary === 'string' ? row.salary : null) ??
        (typeof row.salary_max === 'number' ? row.salary_max : null)
      if (salary === null) return false
      if (typeof filters?.salaryMin === 'number' && salary < filters.salaryMin) return false
      if (typeof filters?.salaryMax === 'number' && salary > filters.salaryMax) return false
      return true
    })
  }

  return rows
}

export async function exportJobsCsv(filters?: CSVExportFilters) {
  const jobs = await getJobs(filters)

  const headers = [
    'title',
    'company',
    'location',
    'status',
    'salary',
    'url',
    'notes',
    'applied_date',
    'created_at',
    'updated_at',
  ]

  const rows = jobs.map((job) => [
    escapeCsv(job.title),
    escapeCsv(job.company),
    escapeCsv(job.location || ''),
    escapeCsv(job.status),
    escapeCsv(job.salary || ''),
    escapeCsv(job.url || ''),
    escapeCsv(job.notes || ''),
    escapeCsv(job.applied_date || ''),
    escapeCsv(job.created_at),
    escapeCsv(job.updated_at),
  ])

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
}

export async function importJobsFromCsv(rows: CSVImportRow[]) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')
  await ensureAppUserExists(user)

  if (!Array.isArray(rows) || rows.length === 0) {
    return { inserted: 0, skipped: 0 }
  }

  const validRows: Array<{
    user_id: string
    source: 'manual'
    is_archived: false
    title: string
    company: string
    location?: string
    status: JobStatus
    salary_min?: number | null
    salary_max?: number | null
    url?: string
    notes?: string
    applied_date: string | null
  }> = []

  let skipped = 0

  for (const row of rows) {
    const normalized: JobFormData = {
      title: (row.title || '').trim(),
      company: (row.company || '').trim(),
      location: cleanOptional(row.location),
      status: normalizeStatus(row.status),
      salary: cleanOptional(row.salary),
      url: cleanOptional(row.url) || '',
      notes: cleanOptional(row.notes),
      applied_date: cleanOptional(row.applied_date),
    }

    const parsed = jobSchema.safeParse(normalized)
    if (!parsed.success) {
      skipped += 1
      continue
    }

    const salaryRange = parseSalaryRange(parsed.data.salary)
    validRows.push({
      user_id: user.id,
      source: 'manual',
      is_archived: false,
      title: parsed.data.title,
      company: parsed.data.company,
      location: parsed.data.location,
      status: parsed.data.status,
      salary_min: salaryRange.salary_min,
      salary_max: salaryRange.salary_max,
      url: parsed.data.url || undefined,
      notes: parsed.data.notes,
      applied_date: parsed.data.applied_date ? new Date(parsed.data.applied_date).toISOString() : null,
    })
  }

  if (validRows.length === 0) {
    return { inserted: 0, skipped }
  }

  const { error } = await supabase.from('jobs').insert(validRows)

  if (error) {
    if (isMissingRelationError(error)) {
      throw new Error('Jobs table is not available yet. Please run the latest database migrations.')
    }
    throw error
  }

  return {
    inserted: validRows.length,
    skipped,
  }
}

export async function getJob(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { error, data } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error) {
    if (isMissingRelationError(error)) {
      throw new Error('Jobs table is not available yet. Please run the latest database migrations.')
    }
    throw error
  }
  return data
}

export async function getJobTimeline(jobId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id')
    .eq('id', jobId)
    .eq('user_id', user.id)
    .single<{ id: string }>()

  if (jobError || !job) {
    throw new Error('Job not found')
  }

  const { data, error } = await supabase
    .from('job_status_timeline')
    .select('id,status,changed_at,notes,ai_confidence_score,requires_review')
    .eq('job_id', jobId)
    .order('changed_at', { ascending: false })

  if (error) {
    if (isMissingRelationError(error)) {
      return []
    }
    throw error
  }

  return (data || []) as JobTimelineEntry[]
}

export async function getJobEmails(jobId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id')
    .eq('id', jobId)
    .eq('user_id', user.id)
    .single<{ id: string }>()

  if (jobError || !job) {
    throw new Error('Job not found')
  }

  const { data, error } = await supabase
    .from('job_emails')
    .select('id,gmail_message_id,from_address,email_direction,subject,body,snippet,received_at,is_read,extracted_data')
    .eq('job_id', jobId)
    .order('received_at', { ascending: false })

  if (error) {
    if (isMissingRelationError(error)) {
      return []
    }
    throw error
  }
  return ((data || []) as JobEmailEntry[]).map((item) => ({
    ...item,
    body: decryptOrReturnPlainText(item.body),
  }))
}

export async function archiveJob(jobId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('jobs')
    .update({
      is_archived: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
    .eq('user_id', user.id)

  if (error) {
    if (isMissingRelationError(error)) {
      throw new Error('Jobs table is not available yet. Please run the latest database migrations.')
    }
    throw error
  }
}

export async function updateJobStatus(jobId: string, status: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  // Statuses that indicate company contact/response
  const contactStatuses = new Set(['Screening', 'Interview', 'Offer', 'Rejected'])
  const now = new Date()

  // Update job status
  const { error: updateError } = await supabase
    .from('jobs')
    .update({
      status,
      updated_at: now,
      ...(contactStatuses.has(status) ? { last_contacted_at: now.toISOString() } : {}),
    })
    .eq('id', jobId)
    .eq('user_id', user.id)

  if (updateError) {
    if (isMissingRelationError(updateError)) {
      throw new Error('Jobs table is not available yet. Please run the latest database migrations.')
    }
    throw updateError
  }

  // Add to timeline
  const { error: timelineError } = await supabase
    .from('job_status_timeline')
    .insert({
      job_id: jobId,
      status,
      changed_at: new Date(),
    })

  if (timelineError) {
    if (isMissingRelationError(timelineError)) {
      throw new Error('Job status timeline table is not available yet. Please run the latest database migrations.')
    }
    throw timelineError
  }
  await updateStreakOnJobActivity(user.id)
}

export async function getReviewQueueItems() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('processed_emails')
    .select('*')
    .eq('user_id', user.id)
    .eq('review_status', 'needs_review')
    .order('processed_at', { ascending: false })

  if (error) throw error
  return data
}

export async function dismissReviewItem(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('processed_emails')
    .update({ review_status: 'auto_rejected', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw error
}

export async function acceptReviewItem(id: string, jobData: JobFormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Check if job exists for this company
  const { data: existingJobs } = await supabase
    .from('jobs')
    .select('id, title, company, status')
    .eq('user_id', user.id)
    .ilike('company', `%${jobData.company}%`)

  let finalJob = null

  if (existingJobs && existingJobs.length > 0) {
    // Try to match by title
    const match = existingJobs.find(j => {
      const dbTitleWords = new Set(j.title.toLowerCase().split(/\W+/))
      const newTitleWords = jobData.title.toLowerCase().split(/\W+/)
      return newTitleWords.some(w => w.length > 3 && dbTitleWords.has(w))
    }) || existingJobs[0]

    // Update the existing job's status if it advanced
    await updateJob(match.id, { 
      status: jobData.status,
      applied_date: jobData.applied_date // keep applying updated date if provided
    })
    
    // Add timeline entry
    await supabase.from('job_status_timeline').insert({
      job_id: match.id,
      status: jobData.status,
      notes: jobData.notes,
      requires_review: false,
    })

    finalJob = match
  } else {
    // create new job
    finalJob = await createJob(jobData)
  }

  await supabase
    .from('processed_emails')
    .update({ review_status: 'auto_accepted', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  return finalJob
}
