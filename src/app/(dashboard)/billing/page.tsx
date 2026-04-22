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
                  {isCheckoutLoading ? 'Redirecting...' : 'Upgrade to Pro'}
                </Button>
                <Button variant="outline" disabled={isCheckoutLoading || isLoading} onClick={() => void handleUpgrade('elite')}>
                  {isCheckoutLoading ? 'Redirecting...' : 'Upgrade to Elite'}
                </Button>
              </div>
            </div>
          ) : (
            <Button disabled={!canManage || isPortalLoading || isLoading} onClick={() => void handleManagePlan()}>
              {isPortalLoading ? 'Opening...' : 'Manage Plan'}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Billing History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-slate-600">Loading billing history...</p>}
          {!isLoading && invoices.length === 0 && <p className="text-slate-600">No billing history yet</p>}

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
