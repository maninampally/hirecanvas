'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ReactQueryProvider } from '@/components/providers/ReactQueryProvider'
 

function isMissingOnboardingColumnError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const code = 'code' in error ? error.code : undefined
  const message = 'message' in error ? error.message : undefined
  if (code === '42703') return true
  return (
    code === 'PGRST204' &&
    typeof message === 'string' &&
    message.includes("'onboarding_completed' column")
  )
}

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { setUser, setLoading, user } = useAuthStore()

  useEffect(() => {
    const supabase = createClient()

    const loadUser = async () => {
      let authUser: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'] | null = null
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        authUser = user
      } catch (error) {
        console.error('Failed to verify auth user:', error)
      }

      if (!authUser) {
        router.push('/login')
        return
      }

      try {
        const { data: appUser, error: appUserError } = await supabase
          .from('app_users')
          .select('tier,onboarding_completed')
          .eq('id', authUser.id)
          .maybeSingle<{ tier: 'free' | 'pro' | 'elite' | 'admin'; onboarding_completed?: boolean }>()

        let resolvedTier: 'free' | 'pro' | 'elite' | 'admin' = 'free'
        let resolvedOnboardingCompleted = false

        if (appUserError && isMissingOnboardingColumnError(appUserError)) {
          const { data: tierOnly, error: tierOnlyError } = await supabase
            .from('app_users')
            .select('tier')
            .eq('id', authUser.id)
            .maybeSingle<{ tier: 'free' | 'pro' | 'elite' | 'admin' }>()
          if (tierOnlyError) throw tierOnlyError
          resolvedTier = tierOnly?.tier || 'free'
        } else {
          if (appUserError) throw appUserError
          resolvedTier = appUser?.tier || 'free'
          resolvedOnboardingCompleted = Boolean(appUser?.onboarding_completed)
        }

        setUser({
          id: authUser.id,
          email: authUser.email || '',
          full_name: authUser.user_metadata?.full_name,
          avatar_url: authUser.user_metadata?.avatar_url,
          tier: resolvedTier,
          onboarding_completed: resolvedOnboardingCompleted,
        })
      } catch (error) {
        // Keep the signed-in user in app even if app_users profile fetch fails transiently.
        console.error('Failed to load app profile, using fallback user state:', error)
        setUser({
          id: authUser.id,
          email: authUser.email || '',
          full_name: authUser.user_metadata?.full_name,
          avatar_url: authUser.user_metadata?.avatar_url,
          tier: 'free',
          onboarding_completed: false,
        })
      } finally {
        setLoading(false)
      }
    }

    loadUser()
  }, [router, setUser, setLoading])

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0fdfb]">
        <div className="text-slate-600">Loading...</div>
      </div>
    )
  }

  return (
    <ReactQueryProvider userId={user.id}>
      <DashboardLayout>
        {children}
      </DashboardLayout>
    </ReactQueryProvider>
  )
}
