import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/security/rateLimit'
import { createClient } from '@/lib/supabase/server'
import { getPriceIdForTier, getStripeClient } from '@/lib/stripe/client'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rateLimit = await enforceRateLimit(user.id, 'checkout_create', 5, 60)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many checkout attempts. Please wait and try again.' },
      { status: 429 }
    )
  }

  const body = (await request.json().catch(() => ({}))) as {
    tier?: 'pro' | 'elite'
    interval?: 'month' | 'year'
    promotionCode?: string
  }
  const targetTier = body.tier
  const interval = body.interval === 'year' ? 'year' : 'month'
  const rawPromo = typeof body.promotionCode === 'string' ? body.promotionCode.trim() : ''

  if (!targetTier || !['pro', 'elite'].includes(targetTier)) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
  }

  const { data: appUser } = await supabase
    .from('app_users')
    .select('stripe_customer_id,email')
    .eq('id', user.id)
    .maybeSingle<{ stripe_customer_id: string | null; email: string | null }>()

  const stripe = getStripeClient()
  let customerId = appUser?.stripe_customer_id || null

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email || appUser?.email || undefined,
      metadata: {
        userId: user.id,
      },
    })
    customerId = customer.id

    await supabase
      .from('app_users')
      .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
      .eq('id', user.id)
  }

  let discounts: { promotion_code: string }[] | undefined
  let allowPromotionCodes = true

  if (rawPromo) {
    const { data: promotionRows } = await stripe.promotionCodes.list({
      code: rawPromo,
      active: true,
      limit: 1,
    })

    const promotion = promotionRows[0]
    if (!promotion) {
      return NextResponse.json(
        { error: 'That promotion code is not valid or is no longer active.' },
        { status: 400 }
      )
    }

    discounts = [{ promotion_code: promotion.id }]
    allowPromotionCodes = false
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [
      {
        price: getPriceIdForTier(targetTier, interval),
        quantity: 1,
      },
    ],
    success_url: `${baseUrl}/billing?success=true`,
    cancel_url: `${baseUrl}/billing?canceled=true`,
    metadata: {
      userId: user.id,
      tier: targetTier,
      interval,
    },
    ...(discounts ? { discounts } : {}),
    allow_promotion_codes: allowPromotionCodes,
  })

  return NextResponse.json({ url: session.url })
}
