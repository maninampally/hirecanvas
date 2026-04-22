'use server'

import { createClient } from '@/lib/supabase/server'
import { templateSchema, type TemplateFormData, type TemplateType } from '@/lib/validations/templates'
import { sanitizeSearchInput, isMissingRelationError } from '@/lib/utils'

export type { TemplateFormData, TemplateType } from '@/lib/validations/templates'

type StarterTemplate = {
  name: string
  type: TemplateType
  category: string
  body: string
}

const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    name: 'Cold Intro to Recruiter',
    type: 'Email',
    category: 'Cold Outreach',
    body: 'Hi {name},\n\nI came across the {role} role at {company} and wanted to introduce myself. I have hands-on experience shipping production features and would love to share a short portfolio.\n\nIf helpful, I can send a concise summary tailored to the team.\n\nThanks,\n[Your Name]',
  },
  {
    name: 'Application Follow-up',
    type: 'Email',
    category: 'Follow-up',
    body: 'Hi {name},\n\nI recently applied for the {role} position at {company}. I wanted to follow up and reiterate my interest in the role.\n\nIf there is any additional information I can provide, I would be happy to share it.\n\nBest,\n[Your Name]',
  },
  {
    name: 'Post-Application Thank You',
    type: 'Email',
    category: 'Post-Application',
    body: 'Hi {name},\n\nThank you for reviewing my application for the {role} role at {company}. I appreciate your time and consideration.\n\nI am excited about the opportunity and would love to contribute to the team.\n\nBest regards,\n[Your Name]',
  },
  {
    name: 'LinkedIn Cold Message',
    type: 'LinkedIn',
    category: 'Cold Outreach',
    body: 'Hi {name} - I am very interested in the {role} opportunity at {company}. I would value any guidance on how to best position my application. Thank you for your time.',
  },
  {
    name: 'LinkedIn Follow-up Nudge',
    type: 'LinkedIn',
    category: 'Follow-up',
    body: 'Hi {name} - following up on my application for {role} at {company}. I remain very interested and would appreciate any update when convenient.',
  },
  {
    name: 'WhatsApp Referral Ask',
    type: 'WhatsApp',
    category: 'Referral',
    body: 'Hi {name}, hope you are doing well. I applied for {role} at {company}. If you are comfortable, would you be open to sharing a referral or guidance on the process?',
  },
]

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
  const validated = templateSchema.parse(data)

  const { data: template, error } = await supabase
    .from('templates')
    .insert({
      ...normalizeTemplateInput(validated),
      user_id: user.id,
      is_archived: false,
    })
    .select('*')
    .single()

  if (error) {
    if (isMissingRelationError(error)) throw new Error('Templates table is not available yet. Please run the latest database migrations.')
    throw error
  }
  return template
}

export async function updateTemplate(id: string, data: TemplateFormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')
  const validated = templateSchema.parse(data)

  const { data: template, error } = await supabase
    .from('templates')
    .update({
      ...normalizeTemplateInput(validated),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*')
    .single()

  if (error) {
    if (isMissingRelationError(error)) throw new Error('Templates table is not available yet. Please run the latest database migrations.')
    throw error
  }
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

  if (error) {
    if (isMissingRelationError(error)) throw new Error('Templates table is not available yet. Please run the latest database migrations.')
    throw error
  }
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
    const value = sanitizeSearchInput(search)
    if (value) {
      query = query.or(`name.ilike.%${value}%,category.ilike.%${value}%,body.ilike.%${value}%`)
    }
  }

  const { data, error } = await query
  if (error) {
    if (isMissingRelationError(error)) return []
    throw error
  }
  return data
}

export async function seedStarterTemplates() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { data: existingRows, error: existingError } = await supabase
    .from('templates')
    .select('name,type,category')
    .eq('user_id', user.id)
    .eq('is_archived', false)

  if (existingError) {
    if (isMissingRelationError(existingError)) {
      throw new Error('Templates table is not available yet. Please run the latest database migrations.')
    }
    throw existingError
  }

  const existingKeys = new Set(
    (existingRows || []).map((row) => `${row.name}__${row.type}__${row.category || ''}`)
  )

  const toInsert = STARTER_TEMPLATES.filter((template) => {
    const key = `${template.name}__${template.type}__${template.category}`
    return !existingKeys.has(key)
  }).map((template) => ({
    ...template,
    user_id: user.id,
    is_archived: false,
  }))

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase.from('templates').insert(toInsert)
    if (insertError) throw insertError
  }

  return {
    inserted: toInsert.length,
    totalStarterTemplates: STARTER_TEMPLATES.length,
  }
}
