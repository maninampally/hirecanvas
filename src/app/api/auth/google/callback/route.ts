import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const next = request.nextUrl.searchParams.get('next') || '/dashboard'
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin

  if (!code) {
    const url = new URL('/login', baseUrl)
    url.searchParams.set('error', 'Missing OAuth code')
    return NextResponse.redirect(url)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    const url = new URL('/login', baseUrl)
    url.searchParams.set('error', error.message)
    return NextResponse.redirect(url)
  }

  const safeNext = next.startsWith('/') ? next : '/dashboard'
  return NextResponse.redirect(new URL(safeNext, baseUrl))
}
