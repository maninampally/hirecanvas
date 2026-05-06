'use server'

import '@/lib/polyfills'
import { generateCoverLetter } from '@/lib/ai/coverLetter'
import { runATSChecker } from '@/lib/ai/atsChecker'
import { tailorResume } from '@/lib/ai/resumeTailor'
import { createClient } from '@/lib/supabase/server'
import { getResumeDownloadUrl as getJobResumeSignedUrl } from '@/actions/resumeUpload'
import { extractTextFromBuffer } from '@/lib/resumes/parser'

export async function getUserTier(): Promise<'free' | 'pro' | 'elite' | 'admin'> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 'free'

  const { data: appUser } = await supabase
    .from('app_users')
    .select('tier')
    .eq('id', user.id)
    .single()

  return (appUser?.tier as any) || 'free'
}

export type ResumeItem = {
  id: string
  name: string
  storage_path: string
  file_size: number | null
  file_type: string | null
  version: number
  is_default: boolean
  ats_score: number | null
  uploaded_at: string | null
  created_at: string
}

/** Row from `job_resumes` (+ job labels) shown alongside library resumes on /resumes */
export type JobAttachedResumeRow = {
  kind: 'job'
  id: string
  job_id: string
  job_company: string
  job_title: string
  file_name: string
  file_size: number
  mime_type: string
  created_at: string
}

export type LibraryResumeRow = { kind: 'library' } & ResumeItem

export type UnifiedResumeRow = LibraryResumeRow | JobAttachedResumeRow

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function assertAllowedFile(file: File) {
  const allowed = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]

  if (!allowed.includes(file.type)) {
    throw new Error('Only PDF or Word documents are allowed')
  }

  const maxBytes = 10 * 1024 * 1024
  if (file.size > maxBytes) {
    throw new Error('Resume file size must be under 10MB')
  }
}

export async function getResumes() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('resumes')
    .select('id,name,storage_path,file_size,file_type,version,is_default,ats_score,uploaded_at,created_at')
    .eq('user_id', user.id)
    .order('is_default', { ascending: false })
    .order('uploaded_at', { ascending: false })

  if (error) throw error
  return (data || []) as ResumeItem[]
}

/**
 * Library resumes plus job-attached resumes (uploaded from Applications),
 * merged newest-first for the /resumes page.
 */
export async function getUnifiedResumeList(): Promise<UnifiedResumeRow[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { data: libRows, error: libError } = await supabase
    .from('resumes')
    .select('id,name,storage_path,file_size,file_type,version,is_default,ats_score,uploaded_at,created_at')
    .eq('user_id', user.id)

  if (libError) throw libError

  const { data: jobRows, error: jobError } = await supabase
    .from('job_resumes')
    .select('id,job_id,file_name,file_size,mime_type,created_at')
    .eq('user_id', user.id)

  if (jobError) throw jobError

  const jobIds = [...new Set((jobRows || []).map((r) => r.job_id))]
  let jobMeta = new Map<string, { company: string; title: string }>()
  if (jobIds.length > 0) {
    const { data: jobsData } = await supabase
      .from('jobs')
      .select('id,company,title')
      .eq('user_id', user.id)
      .in('id', jobIds)

    jobMeta = new Map(
      (jobsData || []).map((j) => [
        j.id,
        { company: j.company || 'Unknown', title: j.title || 'Role' },
      ])
    )
  }

  const library: UnifiedResumeRow[] = (libRows || []).map((row) => ({
    kind: 'library' as const,
    ...row,
  }))

  const fromJobs: UnifiedResumeRow[] = (jobRows || []).map((row) => {
    const meta = jobMeta.get(row.job_id)
    return {
      kind: 'job' as const,
      id: row.id,
      job_id: row.job_id,
      job_company: meta?.company ?? 'Unknown company',
      job_title: meta?.title ?? 'Role',
      file_name: row.file_name,
      file_size: row.file_size,
      mime_type: row.mime_type,
      created_at: row.created_at,
    }
  })

  const merged = [...library, ...fromJobs]
  merged.sort((a, b) => {
    const ta =
      a.kind === 'library'
        ? new Date(a.uploaded_at || a.created_at).getTime()
        : new Date(a.created_at).getTime()
    const tb =
      b.kind === 'library'
        ? new Date(b.uploaded_at || b.created_at).getTime()
        : new Date(b.created_at).getTime()
    return tb - ta
  })

  return merged
}

export async function getResumeSignedUrlForPreview(
  params: { kind: 'library'; id: string } | { kind: 'job'; id: string }
): Promise<{ url: string; fileName: string; mimeType: string }> {
  if (params.kind === 'job') {
    return getJobResumeSignedUrl(params.id)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { data: resume, error } = await supabase
    .from('resumes')
    .select('name,storage_path,file_type')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single<{ name: string; storage_path: string; file_type: string | null }>()

  if (error || !resume) throw new Error('Resume not found')

  const { data: signed, error: signedError } = await supabase.storage
    .from('resumes')
    .createSignedUrl(resume.storage_path, 60 * 60)

  if (signedError || !signed?.signedUrl) {
    throw new Error(signedError?.message || 'Failed to create preview link')
  }

  return {
    url: signed.signedUrl,
    fileName: resume.name,
    mimeType: resume.file_type || 'application/octet-stream',
  }
}

export async function uploadResume(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const file = formData.get('resume')
  if (!(file instanceof File)) {
    throw new Error('Resume file is required')
  }

  assertAllowedFile(file)

  const originalName = file.name.trim() || 'resume'
  const safeName = sanitizeFileName(originalName)
  const storagePath = `${user.id}/${Date.now()}-${safeName}`

  const { data: latestVersionRow } = await supabase
    .from('resumes')
    .select('version')
    .eq('user_id', user.id)
    .eq('name', originalName)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle<{ version: number }>()

  const nextVersion = (latestVersionRow?.version || 0) + 1

  const { error: uploadError } = await supabase.storage
    .from('resumes')
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    throw new Error(uploadError.message)
  }

  const { count } = await supabase
    .from('resumes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const shouldDefault = (count || 0) === 0

  const { data: inserted, error: insertError } = await supabase
    .from('resumes')
    .insert({
      user_id: user.id,
      name: originalName,
      storage_path: storagePath,
      file_size: file.size,
      file_type: file.type,
      version: nextVersion,
      is_default: shouldDefault,
      uploaded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('id,name,storage_path,file_size,file_type,version,is_default,ats_score,uploaded_at,created_at')
    .single<ResumeItem>()

  if (insertError) {
    await supabase.storage.from('resumes').remove([storagePath])
    throw insertError
  }

  return inserted
}

export async function setDefaultResume(resumeId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { error: clearError } = await supabase
    .from('resumes')
    .update({ is_default: false, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)

  if (clearError) throw clearError

  const { data, error } = await supabase
    .from('resumes')
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq('id', resumeId)
    .eq('user_id', user.id)
    .select('id,name,storage_path,file_size,file_type,version,is_default,ats_score,uploaded_at,created_at')
    .single<ResumeItem>()

  if (error) throw error
  return data
}

export async function deleteResume(resumeId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { data: existing, error: existingError } = await supabase
    .from('resumes')
    .select('id,storage_path,is_default')
    .eq('id', resumeId)
    .eq('user_id', user.id)
    .single<{ id: string; storage_path: string; is_default: boolean }>()

  if (existingError || !existing) throw new Error('Resume not found')

  const { error: storageError } = await supabase.storage.from('resumes').remove([existing.storage_path])
  if (storageError) throw storageError

  const { error: deleteError } = await supabase
    .from('resumes')
    .delete()
    .eq('id', resumeId)
    .eq('user_id', user.id)

  if (deleteError) throw deleteError

  if (existing.is_default) {
    const { data: replacement } = await supabase
      .from('resumes')
      .select('id')
      .eq('user_id', user.id)
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string }>()

    if (replacement?.id) {
      await supabase
        .from('resumes')
        .update({ is_default: true, updated_at: new Date().toISOString() })
        .eq('id', replacement.id)
        .eq('user_id', user.id)
    }
  }
}

export async function getResumeDownloadUrl(resumeId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { data: resume, error } = await supabase
    .from('resumes')
    .select('storage_path')
    .eq('id', resumeId)
    .eq('user_id', user.id)
    .single<{ storage_path: string }>()

  if (error || !resume) throw new Error('Resume not found')

  const { data: signed, error: signedError } = await supabase.storage
    .from('resumes')
    .createSignedUrl(resume.storage_path, 60 * 60)

  if (signedError || !signed?.signedUrl) {
    throw new Error(signedError?.message || 'Failed to create download link')
  }

  return signed.signedUrl
}

export async function generateCoverLetterDraft(payload: {
  resumeId: string
  jobTitle: string
  company: string
  jobDescription: string
  tone: 'professional' | 'conversational' | 'creative'
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { data: appUser } = await supabase
    .from('app_users')
    .select('tier')
    .eq('id', user.id)
    .single<{ tier: 'free' | 'pro' | 'elite' | 'admin' }>()

  if (!appUser || (appUser.tier !== 'elite' && appUser.tier !== 'admin')) {
    throw new Error('AI cover letters are available on Elite plan')
  }

  const { data: resume, error } = await supabase
    .from('resumes')
    .select('id,name,file_type')
    .eq('id', payload.resumeId)
    .eq('user_id', user.id)
    .single<{ id: string; name: string; file_type: string | null }>()

  if (error || !resume) {
    throw new Error('Resume not found')
  }

  if (!payload.jobDescription.trim()) {
    throw new Error('Job description is required')
  }

  const result = await generateCoverLetter({
    resumeName: resume.name,
    resumeSummary: `File type: ${resume.file_type || 'unknown'}`,
    jobTitle: payload.jobTitle.trim() || 'Candidate',
    company: payload.company.trim() || 'Company',
    jobDescription: payload.jobDescription.trim(),
    tone: payload.tone,
  })

  await supabase.from('ai_usage').insert({
    user_id: user.id,
    feature: 'cover_letter',
    tokens_used: Math.max(100, Math.ceil(payload.jobDescription.length / 4)),
    cost_cents: 2,
    status: 'completed',
  })

  return result
}

export async function generateATSCheck(payload: {
  resumeText: string
  jobDescription: string
  resumeName?: string
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const resumeText = payload.resumeText.trim()
  const jobDescription = payload.jobDescription.trim()

  if (!resumeText) {
    throw new Error('Resume text is required for ATS analysis')
  }

  if (!jobDescription) {
    throw new Error('Job description is required for ATS analysis')
  }

  const result = await runATSChecker({
    resumeText,
    jobDescription,
    resumeName: payload.resumeName,
  })

  await supabase.from('ai_usage').insert({
    user_id: user.id,
    feature: 'resume_analysis',
    tokens_used: Math.max(100, Math.ceil((resumeText.length + jobDescription.length) / 4)),
    cost_cents: 2,
    status: 'completed',
  })

  return result
}

export async function parseResumeFile(formData: FormData): Promise<{ text: string; fileName: string }> {
  const file = formData.get('file') as File | null
  if (!file) throw new Error('No file provided')

  const buffer = Buffer.from(await file.arrayBuffer())
  const text = await extractTextFromBuffer(buffer, file.type)

  return {
    text: text.trim(),
    fileName: file.name,
  }
}

export async function parseExistingResume(params: {
  kind: 'library' | 'job'
  id: string
}): Promise<{ text: string; fileName: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  let storagePath: string
  let fileName: string
  let mimeType: string

  if (params.kind === 'library') {
    const { data: resume, error } = await supabase
      .from('resumes')
      .select('name, storage_path, file_type')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (error || !resume) throw new Error('Resume not found')
    storagePath = resume.storage_path
    fileName = resume.name
    mimeType = resume.file_type || 'application/octet-stream'
  } else {
    const { data: resume, error } = await supabase
      .from('job_resumes')
      .select('file_name, file_path, mime_type')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (error || !resume) throw new Error('Resume not found')
    storagePath = resume.file_path
    fileName = resume.file_name
    mimeType = resume.mime_type
  }

  const { data, error: downloadError } = await supabase.storage.from('resumes').download(storagePath)
  if (downloadError || !data) throw new Error('Failed to download resume from storage')

  const buffer = Buffer.from(await data.arrayBuffer())
  const text = await extractTextFromBuffer(buffer, mimeType)

  return {
    text: text.trim(),
    fileName,
  }
}

export async function generateTailoredResumeAction(payload: {
  resumeText: string
  jobDescription: string
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  // Check if user is elite or admin for this premium feature
  const { data: appUser } = await supabase
    .from('app_users')
    .select('tier')
    .eq('id', user.id)
    .single<{ tier: string }>()

  if (!appUser || (appUser.tier !== 'elite' && appUser.tier !== 'admin' && appUser.tier !== 'pro')) {
    throw new Error('Resume tailoring is available on Pro and Elite plans')
  }

  const result = await tailorResume({
    resumeText: payload.resumeText,
    jobDescription: payload.jobDescription,
  })

  await supabase.from('ai_usage').insert({
    user_id: user.id,
    feature: 'resume_tailoring',
    tokens_used: Math.max(500, Math.ceil((payload.resumeText.length + payload.jobDescription.length) / 4)),
    cost_cents: 5,
    status: 'completed',
  })

  return result
}
