'use server'

import { createClient } from '@/lib/supabase/server'

type BillingEventRow = {
  id: string
  event_type: string
  amount_cents: number | null
  currency: string | null
  status: string | null
  created_at: string
}

export type BillingStatus = {
  tier: 'free' | 'pro' | 'elite' | 'admin'
  stripeCustomerId: string | null
  tierExpiresAt: string | null
  invoices: BillingEventRow[]
}

function isMissingRelationError(error: { code?: string; message?: string } | null) {
  if (!error) return false
  return error.code === '42P01' || error.message?.toLowerCase().includes('relation') || error.message?.toLowerCase().includes('does not exist')
}

export async function getBillingStatus(): Promise<BillingStatus> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { data: appUser, error: appUserError } = await supabase
    .from('app_users')
    .select('tier,stripe_customer_id,tier_expires_at')
    .eq('id', user.id)
    .single<{ tier: 'free' | 'pro' | 'elite' | 'admin'; stripe_customer_id: string | null; tier_expires_at: string | null }>()

  if (appUserError) throw appUserError

  const { data: billingEvents, error: billingError } = await supabase
    .from('billing_events')
    .select('id,event_type,amount_cents,currency,status,created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (billingError && !isMissingRelationError(billingError)) {
    throw billingError
  }

  return {
    tier: appUser.tier,
    stripeCustomerId: appUser.stripe_customer_id,
    tierExpiresAt: appUser.tier_expires_at,
    invoices: (billingEvents || []) as BillingEventRow[],
  }
}
