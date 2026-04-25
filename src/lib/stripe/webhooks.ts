import type Stripe from 'stripe'
import { createServiceClient } from '@/lib/supabase/service'
import { getTierFromPriceId } from '@/lib/stripe/client'

type UserRow = {
  id: string
  tier: 'free' | 'pro' | 'elite' | 'admin'
  stripe_customer_id: string | null
}

function toIso(value?: number | null) {
  if (!value) return null
  return new Date(value * 1000).toISOString()
}

/** Billing period fields vary across Stripe API versions; read them without relying on narrowed types. */
function subscriptionBillingPeriodUnix(subscription: Stripe.Subscription) {
  const raw = subscription as unknown as {
    current_period_start?: number
    current_period_end?: number
  }

  return {
    start: typeof raw.current_period_start === 'number' ? raw.current_period_start : null,
    end: typeof raw.current_period_end === 'number' ? raw.current_period_end : null,
  }
}

async function findUserByCustomerId(customerId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('app_users')
    .select('id,tier,stripe_customer_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle<UserRow>()

  return data || null
}

async function hasProcessedStripeEvent(eventId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('billing_events')
    .select('stripe_event_id')
    .eq('stripe_event_id', eventId)
    .maybeSingle<{ stripe_event_id: string }>()

  return Boolean(data)
}

async function persistBillingEvent(params: {
  userId: string | null
  event: Stripe.Event
  amountCents?: number | null
  currency?: string | null
  customerId?: string | null
  subscriptionId?: string | null
  status?: string | null
  periodStart?: string | null
  periodEnd?: string | null
}) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('billing_events').insert({
    user_id: params.userId,
    stripe_event_id: params.event.id,
    event_type: params.event.type,
    amount_cents: params.amountCents || 0,
    currency: params.currency || 'usd',
    stripe_customer_id: params.customerId || null,
    stripe_subscription_id: params.subscriptionId || null,
    status: params.status || null,
    period_start: params.periodStart || null,
    period_end: params.periodEnd || null,
    metadata: params.event.data.object as unknown as Record<string, unknown>,
  })

  if (error?.code === '23505') {
    return
  }

  if (error) {
    throw error
  }
}

async function updateUserTierBySubscription(subscription: Stripe.Subscription, customerId: string) {
  const user = await findUserByCustomerId(customerId)
  if (!user) return null

  const subscriptionItem = subscription.items.data[0]
  const matchedTier = subscriptionItem?.price?.id ? getTierFromPriceId(subscriptionItem.price.id) : null
  const nextTier = subscription.status === 'active' && matchedTier ? matchedTier : 'free'

  const period = subscriptionBillingPeriodUnix(subscription)

  const supabase = createServiceClient()
  await supabase
    .from('app_users')
    .update({
      tier: nextTier,
      tier_expires_at: toIso(period.end),
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  return { userId: user.id, nextTier }
}

export async function handleStripeWebhookEvent(event: Stripe.Event) {
  const alreadyProcessed = await hasProcessedStripeEvent(event.id)
  if (alreadyProcessed) {
    return
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
    const userId = typeof session.metadata?.userId === 'string' ? session.metadata.userId : null

    if (customerId && userId) {
      const supabase = createServiceClient()
      await supabase
        .from('app_users')
        .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
        .eq('id', userId)
    }

    await persistBillingEvent({
      userId,
      event,
      amountCents: session.amount_total,
      currency: session.currency,
      customerId: customerId || null,
      subscriptionId: typeof session.subscription === 'string' ? session.subscription : null,
      status: session.payment_status,
    })

    return
  }

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
    const tierUpdate = await updateUserTierBySubscription(subscription, customerId)
    const period = subscriptionBillingPeriodUnix(subscription)

    await persistBillingEvent({
      userId: tierUpdate?.userId || null,
      event,
      amountCents: subscription.items.data[0]?.price?.unit_amount,
      currency: subscription.currency,
      customerId,
      subscriptionId: subscription.id,
      status: subscription.status,
      periodStart: toIso(period.start),
      periodEnd: toIso(period.end),
    })

    return
  }

  await persistBillingEvent({
    userId: null,
    event,
  })
}
