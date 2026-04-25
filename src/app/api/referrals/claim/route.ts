import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as { code?: string }
  const code = body.code?.trim()
  if (!code) return NextResponse.json({ error: 'Missing referral code' }, { status: 400 })

  const service = createServiceClient()
  const { data: referrer } = await service
    .from('app_users')
    .select('id,referral_code')
    .eq('referral_code', code)
    .maybeSingle<{ id: string; referral_code: string }>()

  if (!referrer || referrer.id === user.id) {
    return NextResponse.json({ error: 'Invalid referral code' }, { status: 400 })
  }

  const { data: currentUser } = await service
    .from('app_users')
    .select('referred_by')
    .eq('id', user.id)
    .maybeSingle<{ referred_by: string | null }>()

  if (currentUser?.referred_by) {
    return NextResponse.json({ claimed: false, reason: 'already_claimed' })
  }

  await service
    .from('app_users')
    .update({ referred_by: referrer.id, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  await service.from('referral_events').upsert(
    {
      referrer_user_id: referrer.id,
      referred_user_id: user.id,
      code,
      status: 'pending',
      reward_months: 1,
    },
    { onConflict: 'referred_user_id' }
  )

  return NextResponse.json({ claimed: true })
}
