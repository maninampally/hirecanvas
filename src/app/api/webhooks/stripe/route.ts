import { NextRequest, NextResponse } from 'next/server'
import { getStripeClient } from '@/lib/stripe/client'
import { handleStripeWebhookEvent } from '@/lib/stripe/webhooks'

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ error: 'STRIPE_WEBHOOK_SECRET is not configured' }, { status: 500 })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing Stripe signature' }, { status: 400 })
  }

  const body = await request.text()
  const stripe = getStripeClient()

  try {
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    await handleStripeWebhookEvent(event)
    return NextResponse.json({ received: true })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Invalid Stripe webhook payload',
      },
      { status: 400 }
    )
  }
}
