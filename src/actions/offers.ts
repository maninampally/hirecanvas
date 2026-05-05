'use server'

import { createClient } from '@/lib/supabase/server'
import { isMissingRelationError } from '@/lib/utils'

export type OfferInput = {
  job_id?: string
  title: string
  company: string
  /** ISO date (YYYY-MM-DD) for calendar / deadlines */
  deadline?: string | null
  base_salary?: number
  equity_percent?: number
  equity_value_estimate?: number
  cliff_months?: number
  vest_months?: number
  bonus_percent?: number
  pto_days?: number
  remote_type?: string
  benefits_notes?: string
}

export type OfferRow = OfferInput & {
  id: string
  user_id: string
  created_at: string
  updated_at: string
}

async function getAuthedUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  return { supabase, user }
}

export async function getOffers() {
  const { supabase, user } = await getAuthedUser()
  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) {
    if (isMissingRelationError(error)) return []
    throw error
  }
  return (data || []) as OfferRow[]
}

export async function upsertOffer(input: OfferInput) {
  const { supabase, user } = await getAuthedUser()
  const payload = {
    ...input,
    user_id: user.id,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('offers')
    .upsert(payload, { onConflict: 'user_id,job_id' })
    .select('*')
    .single<OfferRow>()
  if (error) {
    if (isMissingRelationError(error)) {
      throw new Error('Offers table is not available yet. Please run the latest database migrations.')
    }
    throw error
  }
  return data
}

export async function deleteOffer(offerId: string) {
  const { supabase, user } = await getAuthedUser()
  const { error } = await supabase
    .from('offers')
    .delete()
    .eq('id', offerId)
    .eq('user_id', user.id)
  if (error) throw error
  return { deleted: true }
}
