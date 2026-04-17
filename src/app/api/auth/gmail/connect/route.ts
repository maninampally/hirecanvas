import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildGoogleOAuthUrl, generateOAuthState } from '@/lib/gmail/oauth'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'))
  }

  const state = generateOAuthState()
  const response = NextResponse.redirect(buildGoogleOAuthUrl(state))

  response.cookies.set('gmail_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60,
    path: '/',
  })

  return response
}
