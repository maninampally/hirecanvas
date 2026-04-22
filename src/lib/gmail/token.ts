import { refreshAccessToken } from '@/lib/gmail/oauth'
import { decryptSecret, encryptSecret } from '@/lib/security/encryption'
import { recordAuditEvent } from '@/lib/security/audit'
import { createServiceClient } from '@/lib/supabase/service'

type GmailTokenRow = {
  access_token_encrypted: string
  refresh_token_encrypted: string | null
  id_token_encrypted: string | null
  scopes: string[] | null
  expires_at: string | null
  is_revoked: boolean
}

const TOKEN_EXPIRY_SKEW_MS = 60 * 1000

function isExpired(expiresAt: string | null) {
  if (!expiresAt) return false
  return new Date(expiresAt).getTime() <= Date.now() + TOKEN_EXPIRY_SKEW_MS
}

export async function getValidGmailAccessToken(userId: string, tokenId: string) {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('oauth_tokens')
    .select('access_token_encrypted,refresh_token_encrypted,id_token_encrypted,scopes,expires_at,is_revoked')
    .eq('user_id', userId)
    .eq('id', tokenId)
    .eq('provider', 'google_gmail')
    .maybeSingle<GmailTokenRow>()

  if (error) throw error

  if (!data || data.is_revoked) {
    throw new Error('Gmail is not connected. Please reconnect your account.')
  }

  if (!isExpired(data.expires_at)) {
    return {
      accessToken: decryptSecret(data.access_token_encrypted),
      idTokenEncrypted: data.id_token_encrypted,
    }
  }

  if (!data.refresh_token_encrypted) {
    throw new Error('Gmail token expired and no refresh token is available. Please reconnect Gmail.')
  }

  const refreshToken = decryptSecret(data.refresh_token_encrypted)
  const refreshed = await refreshAccessToken(refreshToken)
  const nextExpiresAt = refreshed.expires_in
    ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
    : null

  const { error: updateError } = await supabase
    .from('oauth_tokens')
    .update({
      access_token_encrypted: encryptSecret(refreshed.access_token),
      expires_at: nextExpiresAt,
      scopes: refreshed.scope ? refreshed.scope.split(' ') : data.scopes,
      is_revoked: false,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('id', tokenId)
    .eq('provider', 'google_gmail')

  if (updateError) throw updateError

  return {
    accessToken: refreshed.access_token,
    idTokenEncrypted: data.id_token_encrypted,
  }
}

export async function getAllValidGmailAccessTokens(userId: string) {
  const supabase = createServiceClient()
  
  const { data, error } = await supabase
    .from('oauth_tokens')
    .select('id, provider_email')
    .eq('user_id', userId)
    .eq('provider', 'google_gmail')
    .eq('is_revoked', false)
    
  if (error) throw error
  if (!data || data.length === 0) return []
  
  const results = []
  for (const row of data) {
    try {
      const tokens = await getValidGmailAccessToken(userId, row.id)
      results.push({ ...tokens, tokenId: row.id })
    } catch (err) {
      await recordAuditEvent({
        userId,
        eventType: 'sync_token_failed',
        action: 'sync_process',
        resourceType: 'oauth_tokens',
        resourceId: row.id,
        newValues: { 
          provider_email: row.provider_email,
          error: err instanceof Error ? err.message : 'unknown'
        }
      })
    }
  }
  return results
}
