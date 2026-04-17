'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { DashboardLayout } from '@/components/layout/DashboardLayout'

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { setUser, setLoading, user } = useAuthStore()
  const supabase = createClient()

  useEffect(() => {
    const loadUser = async () => {
      try {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser()

        if (!authUser) {
          router.push('/login')
          return
        }

        // In a real app, fetch full user data from app_users table
        setUser({
          id: authUser.id,
          email: authUser.email || '',
          full_name: authUser.user_metadata?.full_name,
          avatar_url: authUser.user_metadata?.avatar_url,
          tier: 'free', // Default tier - would fetch from DB
        })
      } catch (error) {
        console.error('Failed to load user:', error)
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }

    loadUser()
  }, [supabase, router, setUser, setLoading])

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0fdfb]">
        <div className="text-slate-600">Loading...</div>
      </div>
    )
  }

  return <DashboardLayout>{children}</DashboardLayout>
}
