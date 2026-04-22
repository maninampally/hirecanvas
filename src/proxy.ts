import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

const protectedPaths = [
  '/jobs',
  '/contacts',
  '/outreach',
  '/reminders',
  '/resumes',
  '/templates',
  '/interview-prep',
  '/billing',
  '/settings',
  '/admin',
  '/dashboard',
]

function isProtectedPath(pathname: string) {
  return protectedPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

const AUTH_PAGES = ['/login', '/register', '/forgot-password']

function isExpired(expiresAt: string) {
  const parsed = new Date(expiresAt)
  if (Number.isNaN(parsed.getTime())) return true
  return parsed.getTime() <= Date.now()
}

async function upsertTrackedSession(
  supabase: ReturnType<typeof createServerClient>,
  request: NextRequest,
  response: NextResponse,
  userId: string,
  token?: string
) {
  const sessionToken = token ?? crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  const userAgent = request.headers.get('user-agent')
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null

  const { error } = await supabase.from('user_sessions').upsert(
    {
      user_id: userId,
      session_token: sessionToken,
      user_agent: userAgent,
      ip_address: ipAddress,
      last_activity: new Date().toISOString(),
      expires_at: expiresAt,
    },
    { onConflict: 'session_token' }
  )

  if (!error) {
    response.cookies.set('hc_session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    })
  }
}

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isProtected = isProtectedPath(pathname)
  const isAuthPage = AUTH_PAGES.includes(pathname)

  if (isProtected && user) {
    const sessionCookie = request.cookies.get('hc_session_token')?.value

    if (sessionCookie) {
      const { data: sessionRow, error: sessionLookupError } = await supabase
        .from('user_sessions')
        .select('id,expires_at')
        .eq('user_id', user.id)
        .eq('session_token', sessionCookie)
        .maybeSingle<{ id: string; expires_at: string }>()

      // Only force sign-out when we positively know the tracked session is expired.
      // Missing rows can happen after data migrations or cleanup; recover instead.
      if (sessionRow && isExpired(sessionRow.expires_at)) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        url.searchParams.set('redirectedFrom', pathname)

        await supabase.auth.signOut()
        const logoutResponse = NextResponse.redirect(url)
        logoutResponse.cookies.delete('hc_session_token')
        return logoutResponse
      }

      if (!sessionLookupError && sessionRow) {
        await supabase
          .from('user_sessions')
          .update({ last_activity: new Date().toISOString() })
          .eq('id', sessionRow.id)
          .eq('user_id', user.id)
      } else if (!sessionLookupError) {
        await upsertTrackedSession(supabase, request, response, user.id, sessionCookie)
      }
    } else {
      await upsertTrackedSession(supabase, request, response, user.id)
    }
  }

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectedFrom', pathname)
    return NextResponse.redirect(url)
  }

  if (isAuthPage && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}

