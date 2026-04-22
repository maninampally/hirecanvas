'use server'

import { createClient } from '@/lib/supabase/server'

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'application/rtf',
]

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export type JobResumeItem = {
  id: string
  job_id: string
  file_name: string
  file_path: string
  file_size: number
  mime_type: string
  created_at: string
}

export async function uploadJobResume(jobId: string, formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const file = formData.get('file') as File | null
  if (!file) throw new Error('No file provided')

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error('Invalid file type. Allowed: PDF, DOC, DOCX, TXT, RTF')
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File size exceeds 10MB limit')
  }

  // Verify the job belongs to this user
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id')
    .eq('id', jobId)
    .eq('user_id', user.id)
    .single()

  if (jobError || !job) throw new Error('Job not found')

  // Generate unique storage path
  const timestamp = Date.now()
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${user.id}/${jobId}/${timestamp}_${sanitizedName}`

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('resumes')
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`)
  }

  // Insert record into job_resumes table
  const { data: resume, error: insertError } = await supabase
    .from('job_resumes')
    .insert({
      job_id: jobId,
      user_id: user.id,
      file_name: file.name,
      file_path: storagePath,
      file_size: file.size,
      mime_type: file.type,
    })
    .select()
    .single()

  if (insertError) {
    // Cleanup: remove uploaded file if DB insert fails
    await supabase.storage.from('resumes').remove([storagePath])
    throw new Error(`Failed to save resume record: ${insertError.message}`)
  }

  return resume as JobResumeItem
}

export async function getJobResumes(jobId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('job_resumes')
    .select('id,job_id,file_name,file_path,file_size,mime_type,created_at')
    .eq('job_id', jobId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data || []) as JobResumeItem[]
}

export async function deleteJobResume(resumeId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  // Fetch the resume record
  const { data: resume, error: fetchError } = await supabase
    .from('job_resumes')
    .select('id,file_path')
    .eq('id', resumeId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !resume) throw new Error('Resume not found')

  // Delete from storage
  await supabase.storage.from('resumes').remove([resume.file_path])

  // Delete from DB
  const { error: deleteError } = await supabase
    .from('job_resumes')
    .delete()
    .eq('id', resumeId)
    .eq('user_id', user.id)

  if (deleteError) throw new Error(deleteError.message)
}

export async function getResumeDownloadUrl(resumeId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { data: resume, error: fetchError } = await supabase
    .from('job_resumes')
    .select('id,file_path,file_name')
    .eq('id', resumeId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !resume) throw new Error('Resume not found')

  const { data, error } = await supabase.storage
    .from('resumes')
    .createSignedUrl(resume.file_path, 3600) // 1-hour expiry

  if (error || !data?.signedUrl) throw new Error('Unable to generate download link')

  return { url: data.signedUrl, fileName: resume.file_name }
}
