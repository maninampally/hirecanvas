'use server'

import { createClient } from '@/lib/supabase/server'
import { outreachSchema, type OutreachFormData, type OutreachStatus } from '@/lib/validations/outreach'
import { sanitizeSearchInput, isMissingRelationError } from '@/lib/utils'

export type { OutreachFormData, OutreachMethod, OutreachStatus } from '@/lib/validations/outreach'

function normalizeOutreachInput(data: OutreachFormData) {
  return {
    company: data.company.trim(),
    contact_name: data.contact_name?.trim() || null,
    contact_email: data.contact_email?.trim() || null,
    method: data.method || null,
    status: data.status || 'draft',
    notes: data.notes?.trim() || null,
    outreach_date: data.outreach_date || null,
  }
}

export async function createOutreach(data: OutreachFormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')
  const validated = outreachSchema.parse(data)

  const { data: outreach, error } = await supabase
    .from('outreach')
    .insert({
      ...normalizeOutreachInput(validated),
      user_id: user.id,
    })
    .select('*')
    .single()

  if (error) {
    if (isMissingRelationError(error)) throw new Error('Outreach table is not available yet. Please run the latest database migrations.')
    throw error
  }
  return outreach
}

export async function updateOutreach(id: string, data: OutreachFormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')
  const validated = outreachSchema.parse(data)

  const { data: outreach, error } = await supabase
    .from('outreach')
    .update({
      ...normalizeOutreachInput(validated),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*')
    .single()

  if (error) {
    if (isMissingRelationError(error)) throw new Error('Outreach table is not available yet. Please run the latest database migrations.')
    throw error
  }
  return outreach
}

export async function deleteOutreach(id: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('outreach')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    if (isMissingRelationError(error)) throw new Error('Outreach table is not available yet. Please run the latest database migrations.')
    throw error
  }
}

export async function getOutreach(search?: string, status?: OutreachStatus | '') {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  let query = supabase
    .from('outreach')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  if (search?.trim()) {
    const value = sanitizeSearchInput(search)
    if (value) {
      query = query.or(`company.ilike.%${value}%,contact_name.ilike.%${value}%,contact_email.ilike.%${value}%`)
    }
  }

  const { data, error } = await query
  if (error) {
    if (isMissingRelationError(error)) return []
    throw error
  }
  return data
}
