import Stripe from 'stripe'

let stripeClient: Stripe | null = null

export function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey)
  }

  return stripeClient
}

export function getPriceIdForTier(tier: 'pro' | 'elite', interval: 'month' | 'year' = 'month') {
  const priceId =
    tier === 'pro'
      ? interval === 'year'
        ? process.env.STRIPE_PRO_YEARLY_PRICE_ID
        : process.env.STRIPE_PRO_PRICE_ID
      : interval === 'year'
      ? process.env.STRIPE_ELITE_YEARLY_PRICE_ID
      : process.env.STRIPE_ELITE_PRICE_ID
  if (!priceId) {
    throw new Error(`Missing Stripe price id for tier: ${tier} (${interval})`)
  }

  return priceId
}

export function getTierFromPriceId(priceId: string) {
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return 'pro'
  if (priceId === process.env.STRIPE_PRO_YEARLY_PRICE_ID) return 'pro'
  if (priceId === process.env.STRIPE_ELITE_PRICE_ID) return 'elite'
  if (priceId === process.env.STRIPE_ELITE_YEARLY_PRICE_ID) return 'elite'
  return null
}
