import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/security/rateLimit'
import { createClient } from '@/lib/supabase/server'
import { getStripeClient } from '@/lib/stripe/client'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rateLimit = await enforceRateLimit(user.id, 'billing_portal', 5, 60)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many portal attempts. Please wait and try again.' },
      { status: 429 }
    )
  }

  const { data: appUser } = await supabase
    .from('app_users')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single<{ stripe_customer_id: string | null }>()

  if (!appUser?.stripe_customer_id) {
    return NextResponse.json({ error: 'No Stripe customer found for this user' }, { status: 400 })
  }

  const stripe = getStripeClient()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
  const session = await stripe.billingPortal.sessions.create({
    customer: appUser.stripe_customer_id,
    return_url: `${baseUrl}/billing`,
  })

  return NextResponse.json({ url: session.url })
}
