'use server'

import { createClient } from '@/lib/supabase/server'
import { contactSchema, type ContactFormData } from '@/lib/validations/contacts'
import { sanitizeSearchInput, isMissingRelationError } from '@/lib/utils'

export type { ContactFormData } from '@/lib/validations/contacts'

function normalizeContactInput(data: ContactFormData) {
  return {
    name: data.name.trim(),
    email: data.email?.trim() || null,
    phone: data.phone?.trim() || null,
    company: data.company?.trim() || null,
    title: data.title?.trim() || null,
    relationship: data.relationship || null,
    linkedin_url: data.linkedin_url?.trim() || null,
    notes: data.notes?.trim() || null,
  }
}

export async function createContact(data: ContactFormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')
  const validated = contactSchema.parse(data)

  const { data: contact, error } = await supabase
    .from('contacts')
    .insert({
      ...normalizeContactInput(validated),
      user_id: user.id,
    })
    .select('*')
    .single()

  if (error) {
    if (isMissingRelationError(error)) throw new Error('Contacts table is not available yet. Please run the latest database migrations.')
    throw error
  }
  return contact
}

export async function updateContact(id: string, data: ContactFormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')
  const validated = contactSchema.parse(data)

  const { data: contact, error } = await supabase
    .from('contacts')
    .update({
      ...normalizeContactInput(validated),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*')
    .single()

  if (error) {
    if (isMissingRelationError(error)) throw new Error('Contacts table is not available yet. Please run the latest database migrations.')
    throw error
  }
  return contact
}

export async function deleteContact(id: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    if (isMissingRelationError(error)) throw new Error('Contacts table is not available yet. Please run the latest database migrations.')
    throw error
  }
}

export async function getContacts(search?: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  let query = supabase
    .from('contacts')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (search?.trim()) {
    const value = sanitizeSearchInput(search)
    if (value) {
      query = query.or(`name.ilike.%${value}%,company.ilike.%${value}%,email.ilike.%${value}%`)
    }
  }

  const { data, error } = await query
  if (error) {
    if (isMissingRelationError(error)) return []
    throw error
  }
  return data
}
