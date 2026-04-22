'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { decryptSecret } from '@/lib/security/encryption'
import { recordAuditEvent } from '@/lib/security/audit'
import { listGmailMessages } from '@/lib/gmail/client'
import { getValidGmailAccessToken } from '@/lib/gmail/token'
import { createServiceClient } from '@/lib/supabase/service'

export type NotificationPreferences = {
  email_job_updates: boolean
  sync_completion_alerts: boolean
  weekly_pipeline_summary: boolean
  follow_up_nudges: boolean
  daily_digest: boolean
  feature_announcements: boolean
  marketing_emails: boolean
  unsubscribe_token: string
}

export type AccountUpdateInput = {
  full_name: string
  email: string
  avatar_url?: string
}

export type MFAStatus = {
  is_enabled: boolean
  backup_codes: string[]
}

export type UserSessionItem = {
  id: string
  user_agent: string | null
  ip_address: string | null
  last_activity: string | null
  expires_at: string
  created_at: string
  is_current: boolean
}

export type ConnectionStatus = {
  gmail_connected: boolean
  gmail_email: string | null
  gmail_expires_at: string | null
  gmail_scopes: string[]
  gmail_is_revoked: boolean
}

export type GmailConnectionCheckResult = {
  ok: boolean
  message: string
  messageCountSample?: number
}

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  email_job_updates: true,
  sync_completion_alerts: true,
  weekly_pipeline_summary: true,
  follow_up_nudges: true,
  daily_digest: true,
  feature_announcements: false,
  marketing_emails: false,
  unsubscribe_token: '',
}

function generateBackupCodes(count = 8) {
  const codes: string[] = []
  for (let i = 0; i < count; i += 1) {
    const left = Math.random().toString(36).slice(2, 6).toUpperCase()
    const right = Math.random().toString(36).slice(2, 6).toUpperCase()
    codes.push(`${left}-${right}`)
  }
  return codes
}

async function getAuthenticatedUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  // Google OAuth users may exist in auth.users before app_users row is created.
  // Ensure profile exists so downstream FK inserts (notification_preferences, etc.) do not fail.
  const service = createServiceClient()
  const fullNameRaw = user.user_metadata?.full_name
  const fullName = typeof fullNameRaw === 'string' ? fullNameRaw : ''
  const avatarRaw = user.user_metadata?.avatar_url
  const avatarUrl = typeof avatarRaw === 'string' ? avatarRaw : null

  const { error: profileError } = await service.from('app_users').upsert(
    {
      id: user.id,
      full_name: fullName,
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  )

  if (profileError) throw profileError

  return { supabase, user }
}

export async function getNotificationPreferences() {
  const { supabase, user } = await getAuthenticatedUser()

  const { data, error } = await supabase
    .from('notification_preferences')
    .select(
      'email_job_updates,sync_completion_alerts,weekly_pipeline_summary,follow_up_nudges,daily_digest,feature_announcements,marketing_emails,unsubscribe_token'
    )
    .eq('user_id', user.id)
    .maybeSingle<NotificationPreferences>()

  if (error) throw error

  if (data) return data

  const { data: inserted, error: insertError } = await supabase
    .from('notification_preferences')
    .insert({ user_id: user.id })
    .select(
      'email_job_updates,sync_completion_alerts,weekly_pipeline_summary,follow_up_nudges,daily_digest,feature_announcements,marketing_emails,unsubscribe_token'
    )
    .single<NotificationPreferences>()

  if (insertError) throw insertError

  return inserted || DEFAULT_NOTIFICATION_PREFERENCES
}

export async function updateNotificationPreferences(
  patch: Partial<Omit<NotificationPreferences, 'unsubscribe_token'>>
) {
  const { supabase, user } = await getAuthenticatedUser()

  const { data, error } = await supabase
    .from('notification_preferences')
    .upsert(
      {
        user_id: user.id,
        ...patch,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select(
      'email_job_updates,sync_completion_alerts,weekly_pipeline_summary,follow_up_nudges,daily_digest,feature_announcements,marketing_emails,unsubscribe_token'
    )
    .single<NotificationPreferences>()

  if (error) throw error

  return data
}

export async function updateAccountProfile(input: AccountUpdateInput) {
  const { supabase, user } = await getAuthenticatedUser()

  const fullName = input.full_name.trim()
  const email = input.email.trim().toLowerCase()
  const avatarUrl = input.avatar_url?.trim() || null

  if (!fullName) throw new Error('Full name is required')
  if (!email) throw new Error('Email is required')

  const { error: profileError } = await supabase
    .from('app_users')
    .update({
      full_name: fullName,
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (profileError) throw profileError

  const updatePayload: Parameters<typeof supabase.auth.updateUser>[0] = {
    data: {
      ...(user.user_metadata || {}),
      full_name: fullName,
      avatar_url: avatarUrl,
    },
  }

  if (email !== (user.email || '').toLowerCase()) {
    updatePayload.email = email
  }

  const { error: authError } = await supabase.auth.updateUser(updatePayload)
  if (authError) throw authError

  return {
    full_name: fullName,
    email,
    avatar_url: avatarUrl,
    email_change_pending: email !== (user.email || '').toLowerCase(),
  }
}

export async function getMFAStatus() {
  const { supabase, user } = await getAuthenticatedUser()

  const { data, error } = await supabase
    .from('mfa_config')
    .select('is_enabled,backup_codes')
    .eq('user_id', user.id)
    .maybeSingle<{ is_enabled: boolean; backup_codes: string[] | null }>()

  if (error) throw error

  return {
    is_enabled: data?.is_enabled || false,
    backup_codes: data?.backup_codes || [],
  } as MFAStatus
}

export async function saveMFAStatus(payload: { is_enabled: boolean; backup_codes?: string[] }) {
  const { supabase, user } = await getAuthenticatedUser()

  const codes = payload.backup_codes && payload.backup_codes.length > 0 ? payload.backup_codes : generateBackupCodes()

  const { data, error } = await supabase
    .from('mfa_config')
    .upsert(
      {
        user_id: user.id,
        is_enabled: payload.is_enabled,
        backup_codes: payload.is_enabled ? codes : [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select('is_enabled,backup_codes')
    .single<{ is_enabled: boolean; backup_codes: string[] | null }>()

  if (error) throw error

  await recordAuditEvent({
    userId: user.id,
    eventType: payload.is_enabled ? 'mfa_enabled' : 'mfa_disabled',
    action: payload.is_enabled ? 'enable' : 'disable',
    resourceType: 'mfa_config',
    resourceId: user.id,
    newValues: {
      is_enabled: data.is_enabled,
      backup_code_count: (data.backup_codes || []).length,
    },
  })

  return {
    is_enabled: data.is_enabled,
    backup_codes: data.backup_codes || [],
  } as MFAStatus
}

export async function getUserSessions() {
  const { supabase, user } = await getAuthenticatedUser()
  const cookieStore = await cookies()
  const currentToken = cookieStore.get('hc_session_token')?.value

  const { data, error } = await supabase
    .from('user_sessions')
    .select('id,session_token,user_agent,ip_address,last_activity,expires_at,created_at')
    .eq('user_id', user.id)
    .order('last_activity', { ascending: false })

  if (error) throw error

  return (data || []).map((session) => ({
    id: session.id,
    user_agent: session.user_agent,
    ip_address: session.ip_address,
    last_activity: session.last_activity,
    expires_at: session.expires_at,
    created_at: session.created_at,
    is_current: Boolean(currentToken && session.session_token === currentToken),
  })) as UserSessionItem[]
}

export async function revokeSession(sessionId: string) {
  const { supabase, user } = await getAuthenticatedUser()
  const cookieStore = await cookies()
  const currentToken = cookieStore.get('hc_session_token')?.value

  const { data: row, error: fetchError } = await supabase
    .from('user_sessions')
    .select('session_token')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single<{ session_token: string }>()

  if (fetchError) throw fetchError

  const { error } = await supabase
    .from('user_sessions')
    .delete()
    .eq('id', sessionId)
    .eq('user_id', user.id)

  if (error) throw error

  await recordAuditEvent({
    userId: user.id,
    eventType: 'session_revoked',
    action: 'revoke',
    resourceType: 'user_session',
    resourceId: sessionId,
    newValues: {
      was_current_session: Boolean(currentToken && row.session_token === currentToken),
    },
  })

  return {
    revoked: true,
    was_current_session: Boolean(currentToken && row.session_token === currentToken),
  }
}

export async function getConnectionStatus() {
  const { supabase, user } = await getAuthenticatedUser()

  const { data, error } = await supabase
    .from('oauth_tokens')
    .select('is_revoked,expires_at,scopes,id_token_encrypted')
    .eq('user_id', user.id)
    .eq('provider', 'google_gmail')
    .maybeSingle<{
      is_revoked: boolean
      expires_at: string | null
      scopes: string[] | null
      id_token_encrypted: string | null
    }>()

  if (error) throw error

  let gmailEmail: string | null = null
  if (data?.id_token_encrypted) {
    try {
      const token = decryptSecret(data.id_token_encrypted)
      const payload = token.split('.')[1]
      if (payload) {
        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
        const parsed = JSON.parse(Buffer.from(base64, 'base64').toString('utf8')) as { email?: string }
        gmailEmail = parsed.email || null
      }
    } catch {
      gmailEmail = null
    }
  }

  return {
    gmail_connected: Boolean(data && !data.is_revoked),
    gmail_email: gmailEmail,
    gmail_expires_at: data?.expires_at || null,
    gmail_scopes: data?.scopes || [],
    gmail_is_revoked: data?.is_revoked || false,
  } as ConnectionStatus
}

export async function disconnectGmail() {
  const { supabase, user } = await getAuthenticatedUser()

  const { error } = await supabase
    .from('oauth_tokens')
    .delete()
    .eq('user_id', user.id)
    .eq('provider', 'google_gmail')

  if (error) throw error

  return { disconnected: true }
}

export async function checkGmailConnection() {
  const { user } = await getAuthenticatedUser()

  try {
    const { accessToken } = await getValidGmailAccessToken(user.id)
    const messages = await listGmailMessages(accessToken, 'newer_than:30d', 1)

    return {
      ok: true,
      message: 'Gmail connection is healthy and ready for sync/extraction.',
      messageCountSample: (messages.messages || []).length,
    } as GmailConnectionCheckResult
  } catch (fetchError) {
    return {
      ok: false,
      message:
        fetchError instanceof Error
          ? `Connected but Gmail API check failed: ${fetchError.message}`
          : 'Connected but Gmail API check failed.',
    } as GmailConnectionCheckResult
  }
}
