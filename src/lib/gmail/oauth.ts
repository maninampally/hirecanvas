import { randomBytes } from 'crypto'

const GMAIL_OAUTH_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.readonly',
]

function getGoogleClientId() {
  if (!process.env.GOOGLE_CLIENT_ID) throw new Error('GOOGLE_CLIENT_ID is required')
  return process.env.GOOGLE_CLIENT_ID
}

function getGoogleClientSecret() {
  if (!process.env.GOOGLE_CLIENT_SECRET) throw new Error('GOOGLE_CLIENT_SECRET is required')
  return process.env.GOOGLE_CLIENT_SECRET
}

export function generateOAuthState() {
  return randomBytes(24).toString('hex')
}

export function getGmailRedirectUri() {
  return process.env.GMAIL_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`
}

export function buildGoogleOAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: getGoogleClientId(),
    redirect_uri: getGmailRedirectUri(),
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    scope: GMAIL_OAUTH_SCOPES.join(' '),
    state,
  })

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

export type GoogleTokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  token_type?: string
  id_token?: string
}

export async function exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    code,
    client_id: getGoogleClientId(),
    client_secret: getGoogleClientSecret(),
    redirect_uri: getGmailRedirectUri(),
    grant_type: 'authorization_code',
  })

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  const data = (await response.json()) as GoogleTokenResponse & { error?: string }
  if (!response.ok || data.error) {
    throw new Error(data.error || 'Failed to exchange Google OAuth code')
  }

  return data
}
