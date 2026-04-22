'use server'

import { createClient } from '@/lib/supabase/server'

export type NotificationItem = {
  id: string
  title: string
  message: string | null
  is_read: boolean
  action_url: string | null
  created_at: string
}

async function getAuthed() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  return { supabase, user }
}

export async function getNotifications(limit = 20) {
  const { supabase, user } = await getAuthed()
  const { data, error } = await supabase
    .from('notifications')
    .select('id,title,message,is_read,action_url,created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  const items = (data || []) as NotificationItem[]
  const unreadCount = items.filter((item) => !item.is_read).length
  return { items, unreadCount }
}

export async function markNotificationRead(id: string) {
  const { supabase, user } = await getAuthed()
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) throw error
  return { ok: true }
}

export async function markAllNotificationsRead() {
  const { supabase, user } = await getAuthed()
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('is_read', false)
  if (error) throw error
  return { ok: true }
}

