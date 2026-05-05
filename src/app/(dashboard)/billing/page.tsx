'use client'

import { useEffect, useMemo, useState, startTransition } from 'react'
import { getBillingStatus, type BillingStatus } from '@/actions/billing'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { useAuthStore } from '@/stores/authStore'
import { TIER_LABELS } from '@/lib/constants'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'

export default function BillingPage() {
  const { user, setUser } = useAuthStore()
  const [isLoading, setIsLoading] = useState(true)
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false)
  const [isPortalLoading, setIsPortalLoading] = useState(false)
  const [interval, setInterval] = useState<'month' | 'year'>('month')
  const [data, setData] = useState<BillingStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [promotionCode, setPromotionCode] = useState('')

  useEffect(() => {
    let mounted = true

    const load = async () => {
      try {
        setError(null)
        const billing = await getBillingStatus()
        if (!mounted) return
        setData(billing)

        if (user && user.tier !== billing.tier) {
          setUser({ ...user, tier: billing.tier })
        }
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Unable to load billing status')
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    void load()
    return () => {
      mounted = false
    }
  }, [setUser, user])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const fromQuery = params.get('promo') || params.get('code') || params.get('coupon')
    const trimmed = fromQuery?.trim()
    if (trimmed) {
      startTransition(() => setPromotionCode(trimmed))
    }
  }, [])

  const currentTier = data?.tier || user?.tier || 'free'
  const invoices = data?.invoices || []
  const canManage = Boolean(data?.stripeCustomerId)

  const planBadgeVariant = useMemo(() => {
    if (currentTier === 'elite') return 'violet'
    if (currentTier === 'pro') return 'teal'
    if (currentTier === 'admin') return 'amber'
    return 'slate'
  }, [currentTier])

  async function handleUpgrade(tier: 'pro' | 'elite') {
    setIsCheckoutLoading(true)
    try {
      const trimmedPromo = promotionCode.trim()
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier,
          interval,
          ...(trimmedPromo ? { promotionCode: trimmedPromo } : {}),
        }),
      })

      const body = (await response.json()) as { url?: string; error?: string }
      if (!response.ok || !body.url) {
        throw new Error(body.error || 'Failed to start checkout')
      }

      window.location.href = body.url
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to open checkout')
    } finally {
      setIsCheckoutLoading(false)
    }
  }

  async function handleManagePlan() {
    setIsPortalLoading(true)
    try {
      const response = await fetch('/api/portal', {
        method: 'POST',
      })

      const body = (await response.json()) as { url?: string; error?: string }
      if (!response.ok || !body.url) {
        throw new Error(body.error || 'Failed to open billing portal')
      }

      window.location.href = body.url
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to open billing portal')
    } finally {
      setIsPortalLoading(false)
    }
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <PageHeader title="Billing" description="Manage your subscription and billing history" />

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-slate-600">Plan</p>
            <div className="mt-1 flex items-center gap-2">
              <p className="text-lg font-semibold">{TIER_LABELS[currentTier]}</p>
              <Badge variant={planBadgeVariant}>{currentTier.toUpperCase()}</Badge>
            </div>
            {data?.tierExpiresAt && (
              <p className="mt-1 text-xs text-slate-500">
                Renews through {new Date(data.tierExpiresAt).toLocaleDateString()}
              </p>
            )}
          </div>
          <p className="text-sm text-slate-600">
            {currentTier === 'free'
              ? 'Upgrade to unlock higher limits and advanced automation features.'
              : 'Manage your billing details and subscription changes from this page.'}
          </p>

          {currentTier === 'free' ? (
            <div className="space-y-4">
              <div className="inline-flex rounded-lg border border-slate-200 p-1">
                <button
                  type="button"
                  className={`rounded-md px-3 py-1.5 text-sm ${interval === 'month' ? 'bg-teal-500 text-white' : 'text-slate-600'}`}
                  onClick={() => setInterval('month')}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  className={`rounded-md px-3 py-1.5 text-sm ${interval === 'year' ? 'bg-teal-500 text-white' : 'text-slate-600'}`}
                  onClick={() => setInterval('year')}
                >
                  Yearly (save ~20%)
                </button>
              </div>

              <div className="space-y-2">
                <label htmlFor="billing-promo-code" className="text-sm font-medium text-slate-700">
                  Promotion code (optional)
                </label>
                <Input
                  id="billing-promo-code"
                  name="promotionCode"
                  autoComplete="off"
                  placeholder="Enter a code from your invite or campaign"
                  value={promotionCode}
                  onChange={(e) => setPromotionCode(e.target.value)}
                  disabled={isCheckoutLoading || isLoading}
                />
                <p className="text-xs text-slate-500">
                  If you leave this blank, you can still enter a code on the Stripe checkout page when available.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button disabled={isCheckoutLoading || isLoading} onClick={() => void handleUpgrade('pro')}>
                  {isCheckoutLoading ? 'Redirecting...' : `Upgrade to Pro (${interval})`}
                </Button>
                <Button variant="outline" disabled={isCheckoutLoading || isLoading} onClick={() => void handleUpgrade('elite')}>
                  {isCheckoutLoading ? 'Redirecting...' : `Upgrade to Elite (${interval})`}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Button disabled={!canManage || isPortalLoading || isLoading} onClick={() => void handleManagePlan()}>
                {isPortalLoading ? 'Opening...' : 'Manage Plan'}
              </Button>
              {!canManage && !isLoading && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-sm font-semibold text-amber-800">Billing Portal Unavailable</p>
                  </div>
                  <p className="text-xs text-amber-700">
                    Your account is on the <strong>{currentTier}</strong> plan but no Stripe customer ID was linked.
                    This usually happens when the payment webhook was not processed (network timeout, duplicate event, or signup race condition).
                  </p>
                    <p className="text-xs text-amber-700">
                      <strong>To resolve:</strong> Email{' '}
                      <a
                        href={`mailto:support@hirecanvas.app?subject=Billing%20Portal%20Issue&body=Hi%2C%20my%20account%20is%20on%20the%20${currentTier}%20plan%20but%20I%20cannot%20access%20the%20billing%20portal.%20Please%20check%20my%20Stripe%20customer%20ID%20linkage.`}
                        className="font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-700"
                      >
                        support@hirecanvas.app
                      </a>{' '}
                      with your account email and current plan. We will manually link your Stripe customer ID within 24 hours.
                    </p>
                  <p className="text-[11px] text-amber-600 mt-1">
                    Your subscription is still active — this is a display/linkage issue only.
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Billing History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="animate-pulse space-y-2 py-2">
              {[1, 2].map((i) => (
                <div key={i} className="flex gap-4 py-2">
                  <div className="h-4 w-28 rounded bg-slate-200" />
                  <div className="h-4 w-32 rounded bg-slate-200" />
                  <div className="h-4 w-20 rounded bg-slate-200" />
                  <div className="ml-auto h-4 w-16 rounded bg-slate-200" />
                </div>
              ))}
            </div>
          )}
          {!isLoading && invoices.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-700">No billing history yet</p>
              <p className="text-xs text-slate-500">Invoices and payment records will appear here once you&apos;ve made a transaction.</p>
            </div>
          )}

          {!isLoading && invoices.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                    <th className="px-2 py-2 text-left">Date</th>
                    <th className="px-2 py-2 text-left">Event</th>
                    <th className="px-2 py-2 text-left">Status</th>
                    <th className="px-2 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 text-sm">
                      <td className="px-2 py-2">{new Date(item.created_at).toLocaleDateString()}</td>
                      <td className="px-2 py-2">{item.event_type}</td>
                      <td className="px-2 py-2">{item.status || 'n/a'}</td>
                      <td className="px-2 py-2 text-right">
                        ${((item.amount_cents || 0) / 100).toFixed(2)} {item.currency?.toUpperCase() || 'USD'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
