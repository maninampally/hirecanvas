import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exchangeCodeForTokens } from '@/lib/gmail/oauth'
import { encryptSecret } from '@/lib/security/encryption'

function redirectWithParams(pathname: string, params: Record<string, string>) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const url = new URL(pathname, baseUrl)
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })
  return url
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const stateCookie = request.cookies.get('gmail_oauth_state')?.value

  if (!code || !state || !stateCookie || state !== stateCookie) {
    const response = NextResponse.redirect(
      redirectWithParams('/settings', { error: 'invalid_oauth_state', tab: 'connections' })
    )
    response.cookies.delete('gmail_oauth_state')
    return response
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const response = NextResponse.redirect(
      redirectWithParams('/login', { error: 'auth_required' })
    )
    response.cookies.delete('gmail_oauth_state')
    return response
  }

  try {
    const tokens = await exchangeCodeForTokens(code)

    if (!tokens.access_token) {
      throw new Error('Missing access token from provider')
    }

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null

    const { error } = await supabase.from('oauth_tokens').upsert(
      {
        user_id: user.id,
        provider: 'google_gmail',
        access_token_encrypted: encryptSecret(tokens.access_token),
        refresh_token_encrypted: tokens.refresh_token
          ? encryptSecret(tokens.refresh_token)
          : null,
        id_token_encrypted: tokens.id_token ? encryptSecret(tokens.id_token) : null,
        expires_at: expiresAt,
        scopes: tokens.scope ? tokens.scope.split(' ') : null,
        is_revoked: false,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,provider',
      }
    )

    if (error) {
      throw error
    }

    const response = NextResponse.redirect(
      redirectWithParams('/settings', { connected: 'gmail', tab: 'connections' })
    )
    response.cookies.delete('gmail_oauth_state')
    return response
  } catch (error) {
    const response = NextResponse.redirect(
      redirectWithParams('/settings', {
        error: error instanceof Error ? error.message : 'oauth_failed',
        tab: 'connections',
      })
    )
    response.cookies.delete('gmail_oauth_state')
    return response
  }
}
