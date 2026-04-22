'use server'

import { createClient } from '@/lib/supabase/server'

export type OnboardingState = {
  completed: boolean
  hasGmailConnected: boolean
  hasCreatedJob: boolean
  hasRunSync: boolean
}

type SupabaseColumnError = {
  code?: string
  message?: string
}

function isMissingOnboardingColumnError(error: SupabaseColumnError | null | undefined) {
  if (!error) return false
  if (error.code === '42703') return true
  return (
    error.code === 'PGRST204' &&
    typeof error.message === 'string' &&
    error.message.includes("'onboarding_completed' column")
  )
}

async function getAuthedClient() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  return { supabase, user }
}

export async function getOnboardingState(): Promise<OnboardingState> {
  const { supabase, user } = await getAuthedClient()

  const [{ data: appUser, error: appUserError }, { count: jobsCount }, { data: oauth }, { count: syncCount }] =
    await Promise.all([
      supabase
        .from('app_users')
        .select('onboarding_completed')
        .eq('id', user.id)
        .maybeSingle<{ onboarding_completed?: boolean }>(),
      supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_archived', false),
      supabase
        .from('oauth_tokens')
        .select('id,is_revoked')
        .eq('user_id', user.id)
        .eq('provider', 'google_gmail')
        .maybeSingle<{ id: string; is_revoked: boolean }>(),
      supabase
        .from('sync_status')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'completed'),
    ])

  if (appUserError && !isMissingOnboardingColumnError(appUserError)) {
    throw appUserError
  }

  return {
    completed: appUserError ? false : Boolean(appUser?.onboarding_completed),
    hasGmailConnected: Boolean(oauth && !oauth.is_revoked),
    hasCreatedJob: (jobsCount || 0) > 0,
    hasRunSync: (syncCount || 0) > 0,
  }
}

export async function setOnboardingCompleted(completed = true) {
  const { supabase, user } = await getAuthedClient()
  const { error } = await supabase
    .from('app_users')
    .update({ onboarding_completed: completed, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error && !isMissingOnboardingColumnError(error)) throw error
  return { completed }
}

