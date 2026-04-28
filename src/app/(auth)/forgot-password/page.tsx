'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const supabase = createClient()
      const redirectTo = `${window.location.origin}/reset-password`
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
      if (resetError) throw resetError
      setSuccess('Reset link sent. Check your inbox and spam folder.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send password reset link')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="shadow-teal-md border-slate-200/60">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-2xl">Reset your password</CardTitle>
        <CardDescription>We will send you a secure password reset link.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          {success && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p>}

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">Email</label>
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <Button type="submit" className="w-full" isLoading={loading}>
            {loading ? 'Sending link...' : 'Send reset link'}
          </Button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          Back to{' '}
          <Link href="/login" className="text-teal-600 hover:text-teal-700 font-semibold">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
