'use server'

import { createClient } from '@/lib/supabase/server'
import { reminderSchema, type ReminderFormData } from '@/lib/validations/reminders'
import { isMissingRelationError } from '@/lib/utils'

export type { ReminderFormData, ReminderType } from '@/lib/validations/reminders'

function normalizeReminderInput(data: ReminderFormData) {
  return {
    title: data.title.trim(),
    type: data.type || 'Other',
    due_date: data.due_date,
    notes: data.notes?.trim() || null,
  }
}

export async function createReminder(data: ReminderFormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')
  const validated = reminderSchema.parse(data)

  const { data: reminder, error } = await supabase
    .from('reminders')
    .insert({
      ...normalizeReminderInput(validated),
      user_id: user.id,
    })
    .select('*')
    .single()

  if (error) {
    if (isMissingRelationError(error)) throw new Error('Reminders table is not available yet. Please run the latest database migrations.')
    throw error
  }
  return reminder
}

export async function updateReminder(id: string, data: ReminderFormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')
  const validated = reminderSchema.parse(data)

  const { data: reminder, error } = await supabase
    .from('reminders')
    .update({
      ...normalizeReminderInput(validated),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*')
    .single()

  if (error) {
    if (isMissingRelationError(error)) throw new Error('Reminders table is not available yet. Please run the latest database migrations.')
    throw error
  }
  return reminder
}

export async function toggleReminderComplete(id: string, completed: boolean) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { data: reminder, error } = await supabase
    .from('reminders')
    .update({
      completed_at: completed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*')
    .single()

  if (error) {
    if (isMissingRelationError(error)) throw new Error('Reminders table is not available yet. Please run the latest database migrations.')
    throw error
  }
  return reminder
}

export async function deleteReminder(id: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('reminders')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    if (isMissingRelationError(error)) throw new Error('Reminders table is not available yet. Please run the latest database migrations.')
    throw error
  }
}

export async function getReminders(showCompleted: boolean) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  let query = supabase
    .from('reminders')
    .select('*')
    .eq('user_id', user.id)
    .order('due_date', { ascending: true })

  if (!showCompleted) {
    query = query.is('completed_at', null)
  }

  const { data, error } = await query
  if (error) {
    if (isMissingRelationError(error)) return []
    throw error
  }
  return data
}
