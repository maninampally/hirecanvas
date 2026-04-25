import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

const protectedPaths = [
  "/applications",
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
const EMAIL_VERIFICATION_PAGE = '/verify-email'

function isEmailVerified(user: { email_confirmed_at?: string | null }) {
  return Boolean(user.email_confirmed_at)
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
  const isVerifyEmailPage = pathname === EMAIL_VERIFICATION_PAGE

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectedFrom', pathname)
    return NextResponse.redirect(url)
  }

  if (user && isProtected && !isEmailVerified(user) && !isVerifyEmailPage) {
    const url = request.nextUrl.clone()
    url.pathname = EMAIL_VERIFICATION_PAGE
    url.searchParams.set('redirectedFrom', pathname)
    return NextResponse.redirect(url)
  }

  if (isAuthPage && user) {
    const url = request.nextUrl.clone()
    if (isEmailVerified(user)) {
      url.pathname = '/'
      url.search = ''
    } else {
      url.pathname = EMAIL_VERIFICATION_PAGE
      url.search = ''
    }
    return NextResponse.redirect(url)
  }

  if (isVerifyEmailPage && user && isEmailVerified(user)) {
    const url = request.nextUrl.clone()
    url.pathname = request.nextUrl.searchParams.get('redirectedFrom') || '/dashboard'
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

