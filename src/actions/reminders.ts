'use server'

import { createClient } from '@/lib/supabase/server'

export type ReminderType = 'Follow Up' | 'Apply Deadline' | 'Interview Prep' | 'Other'

export type ReminderFormData = {
  title: string
  type?: ReminderType
  due_date: string
  notes?: string
}

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
  if (!data.title?.trim()) throw new Error('Title is required')
  if (!data.due_date) throw new Error('Due date is required')

  const { data: reminder, error } = await supabase
    .from('reminders')
    .insert({
      ...normalizeReminderInput(data),
      user_id: user.id,
    })
    .select('*')
    .single()

  if (error) throw error
  return reminder
}

export async function updateReminder(id: string, data: ReminderFormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')
  if (!data.title?.trim()) throw new Error('Title is required')
  if (!data.due_date) throw new Error('Due date is required')

  const { data: reminder, error } = await supabase
    .from('reminders')
    .update({
      ...normalizeReminderInput(data),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*')
    .single()

  if (error) throw error
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

  if (error) throw error
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

  if (error) throw error
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
  if (error) throw error
  return data
}
