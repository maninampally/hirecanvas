'use server'

import { createClient } from '@/lib/supabase/server'
import { jobSchema, JobFormData } from '@/lib/validations/jobs'

function isMissingRelationError(error: { code?: string; message?: string } | null) {
  if (!error) return false
  return (
    error.code === '42P01' ||
    error.message?.toLowerCase().includes('relation') ||
    error.message?.toLowerCase().includes('does not exist')
  )
}

export async function createJob(data: JobFormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const validated = jobSchema.parse(data)

  const { error, data: job } = await supabase
    .from('jobs')
    .insert({
      ...validated,
      user_id: user.id,
      source: 'manual',
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
  return job
}

export async function updateJob(id: string, data: Partial<JobFormData>) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { error, data: job } = await supabase
    .from('jobs')
    .update({
      ...data,
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
    search?: string
  }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  let query = supabase
    .from('jobs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.search) {
    query = query.or(`title.ilike.%${filters.search}%,company.ilike.%${filters.search}%`)
  }

  const { error, data } = await query

  if (error) {
    if (isMissingRelationError(error)) {
      // Allow UI to render before migrations are applied.
      return []
    }
    throw error
  }
  return data
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

export async function updateJobStatus(jobId: string, status: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  // Update job status
  const { error: updateError } = await supabase
    .from('jobs')
    .update({ status, updated_at: new Date() })
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
}
