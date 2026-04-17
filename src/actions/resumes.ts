'use server'

import { createClient } from '@/lib/supabase/server'

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
