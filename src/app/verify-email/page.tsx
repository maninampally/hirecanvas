'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

const RESEND_COOLDOWN_SECONDS = 30

function VerifyEmailContent() {
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  function getSupabase() {
    if (!supabaseRef.current) supabaseRef.current = createClient()
    return supabaseRef.current
  }
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectedFrom = searchParams.get('redirectedFrom') || '/dashboard'

  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    void (async () => {
      const {
        data: { user },
      } = await getSupabase().auth.getUser()

      if (!mounted) return

      if (!user) {
        router.replace('/login')
        return
      }

      setEmail(user.email || null)
      if (user.email_confirmed_at) {
        router.replace(redirectedFrom)
      }
    })()

    return () => {
      mounted = false
    }
  }, [redirectedFrom, router])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [cooldown])

  async function handleResend() {
    if (!email || cooldown > 0) return
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const { error: resendError } = await getSupabase().auth.resend({
        type: 'signup',
        email,
      })
      if (resendError) throw resendError
      setMessage('Verification email sent. Check your inbox and spam folder.')
      setCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend verification email')
    } finally {
      setLoading(false)
    }
  }

  async function handleIConfirmed() {
    setChecking(true)
    setError(null)
    try {
      const {
        data: { user },
      } = await getSupabase().auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }
      if (user.email_confirmed_at) {
        router.replace(redirectedFrom)
        return
      }
      setError('Email not verified yet. Please click the link from your inbox first.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-xl items-center px-4 py-10">
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Verify your email</h1>
        <p className="mt-2 text-sm text-slate-600">
          We sent a verification link to <span className="font-medium text-slate-800">{email || 'your email'}</span>.
          Open that link, then return here.
        </p>

        {message ? (
          <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button type="button" onClick={() => void handleIConfirmed()} isLoading={checking}>
            I verified my email
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleResend()}
            disabled={loading || cooldown > 0 || !email}
            isLoading={loading}
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend verification email'}
          </Button>
        </div>

        <p className="mt-5 text-sm text-slate-500">
          Wrong account? <Link href="/login" className="text-teal-600 hover:underline">Sign in</Link>
        </p>
      </div>
    </main>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-[70vh] w-full max-w-xl items-center px-4 py-10">
          <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-semibold text-slate-900">Verify your email</h1>
            <p className="mt-2 text-sm text-slate-600">Loading verification details...</p>
          </div>
        </main>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  )
}
