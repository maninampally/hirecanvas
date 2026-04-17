'use server'

import { createClient } from '@/lib/supabase/server'

export type TemplateType = 'Email' | 'LinkedIn' | 'WhatsApp' | 'Cover Letter'

export type TemplateFormData = {
  name: string
  type: TemplateType
  category?: string
  body: string
}

function normalizeTemplateInput(data: TemplateFormData) {
  return {
    name: data.name.trim(),
    type: data.type,
    category: data.category?.trim() || null,
    body: data.body.trim(),
  }
}

export async function createTemplate(data: TemplateFormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')
  if (!data.name?.trim()) throw new Error('Template name is required')
  if (!data.body?.trim()) throw new Error('Template body is required')

  const { data: template, error } = await supabase
    .from('templates')
    .insert({
      ...normalizeTemplateInput(data),
      user_id: user.id,
      is_archived: false,
    })
    .select('*')
    .single()

  if (error) throw error
  return template
}

export async function updateTemplate(id: string, data: TemplateFormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')
  if (!data.name?.trim()) throw new Error('Template name is required')
  if (!data.body?.trim()) throw new Error('Template body is required')

  const { data: template, error } = await supabase
    .from('templates')
    .update({
      ...normalizeTemplateInput(data),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*')
    .single()

  if (error) throw error
  return template
}

export async function deleteTemplate(id: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('templates')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw error
}

export async function getTemplates(search?: string, type?: TemplateType | '') {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  let query = supabase
    .from('templates')
    .select('*')
    .or(`user_id.eq.${user.id},user_id.is.null`)
    .eq('is_archived', false)
    .order('created_at', { ascending: false })

  if (type) {
    query = query.eq('type', type)
  }

  if (search?.trim()) {
    const value = search.trim()
    query = query.or(`name.ilike.%${value}%,category.ilike.%${value}%,body.ilike.%${value}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}
