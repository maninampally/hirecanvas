import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
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

  const referralCode = request.cookies.get('hc_ref')?.value
  if (referralCode) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const service = createServiceClient()
      const { data: referrer } = await service
        .from('app_users')
        .select('id')
        .eq('referral_code', referralCode)
        .maybeSingle<{ id: string }>()
      if (referrer && referrer.id !== user.id) {
        const { data: existing } = await service
          .from('app_users')
          .select('referred_by')
          .eq('id', user.id)
          .maybeSingle<{ referred_by: string | null }>()
        if (!existing?.referred_by) {
          await service
            .from('app_users')
            .update({ referred_by: referrer.id, updated_at: new Date().toISOString() })
            .eq('id', user.id)
          await service.from('referral_events').upsert(
            {
              referrer_user_id: referrer.id,
              referred_user_id: user.id,
              code: referralCode,
              status: 'pending',
              reward_months: 1,
            },
            { onConflict: 'referred_user_id' }
          )
        }
      }
    }
  }

  const safeNext = next.startsWith('/') ? next : '/dashboard'
  return NextResponse.redirect(new URL(safeNext, baseUrl))
}
