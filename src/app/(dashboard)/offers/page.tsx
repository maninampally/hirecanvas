'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getOffers, upsertOffer, deleteOffer, type OfferRow } from '@/actions/offers'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { OfferComparison } from '@/components/offers/OfferComparison'
import { toast } from 'sonner'
import { MdAdd, MdDeleteOutline, MdClose, MdWorkspacePremium } from 'react-icons/md'

const EMPTY_FORM = {
  title: '',
  company: '',
  deadline: '',
  base_salary: '',
  bonus_percent: '',
  equity_value_estimate: '',
  pto_days: '',
  remote_type: '',
  benefits_notes: '',
}

function formatCurrency(val: number | null | undefined) {
  if (!val) return '—'
  return `$${val.toLocaleString()}`
}

function totalComp(offer: OfferRow) {
  const base = Number(offer.base_salary || 0)
  const equity = Number(offer.equity_value_estimate || 0)
  const bonus = base * (Number(offer.bonus_percent || 0) / 100)
  return Math.round(base + equity + bonus)
}

function OfferCard({
  offer,
  isTop,
  onDelete,
}: {
  offer: OfferRow
  isTop: boolean
  onDelete: () => void
}) {
  const total = totalComp(offer)
  return (
    <div
      className={`relative rounded-2xl border p-5 transition-all ${
        isTop
          ? 'border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50 shadow-md'
          : 'border-slate-200 bg-white'
      }`}
    >
      {isTop && (
        <span className="absolute -top-3 left-4 flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[11px] font-bold text-white shadow">
          <MdWorkspacePremium className="text-sm" /> Best Total Comp
        </span>
      )}
      <button
        type="button"
        onClick={onDelete}
        className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors"
        aria-label={`Remove ${offer.company} offer`}
      >
        <MdDeleteOutline className="text-base" />
      </button>

      <div className="mb-4">
        <p className="text-base font-bold text-slate-900">{offer.company}</p>
        <p className="text-sm text-slate-500">{offer.title}</p>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Base Salary</p>
          <p className="text-sm font-semibold text-slate-800">{formatCurrency(offer.base_salary)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Bonus</p>
          <p className="text-sm font-semibold text-slate-800">{offer.bonus_percent ? `${offer.bonus_percent}%` : '—'}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Equity Est.</p>
          <p className="text-sm font-semibold text-slate-800">{formatCurrency(offer.equity_value_estimate)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">PTO</p>
          <p className="text-sm font-semibold text-slate-800">{offer.pto_days ? `${offer.pto_days} days` : '—'}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Work Type</p>
          <p className="text-sm font-semibold text-slate-800">{offer.remote_type || '—'}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Deadline</p>
          <p className="text-sm font-semibold text-slate-800">
            {offer.deadline ? offer.deadline.slice(0, 10) : '—'}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total Comp</p>
          <p className={`text-sm font-bold ${isTop ? 'text-emerald-700' : 'text-slate-800'}`}>
            {formatCurrency(total)}
          </p>
        </div>
      </div>

      {offer.benefits_notes && (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 border border-slate-100">
          {offer.benefits_notes}
        </p>
      )}
    </div>
  )
}

export default function OffersPage() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  const offersQuery = useQuery({
    queryKey: ['offers'],
    queryFn: getOffers,
  })

  const offers = offersQuery.data || []
  const topOffer = offers.length > 0
    ? offers.reduce((best, o) => totalComp(o) > totalComp(best) ? o : best)
    : null

  const saveMutation = useMutation({
    mutationFn: async () =>
      upsertOffer({
        title: form.title,
        company: form.company,
        deadline: form.deadline.trim() || undefined,
        base_salary: form.base_salary ? Number(form.base_salary) : undefined,
        bonus_percent: form.bonus_percent ? Number(form.bonus_percent) : undefined,
        equity_value_estimate: form.equity_value_estimate ? Number(form.equity_value_estimate) : undefined,
        pto_days: form.pto_days ? Number(form.pto_days) : undefined,
        remote_type: form.remote_type || undefined,
        benefits_notes: form.benefits_notes || undefined,
      }),
    onSuccess: async () => {
      toast.success('Offer saved')
      await queryClient.invalidateQueries({ queryKey: ['offers'] })
      setForm(EMPTY_FORM)
      setShowForm(false)
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Unable to save offer')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (offerId: string) => deleteOffer(offerId),
    onSuccess: async () => {
      toast.success('Offer removed')
      await queryClient.invalidateQueries({ queryKey: ['offers'] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Unable to remove offer')
    },
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Offer Comparison"
        description="Compare up to 4 offers side-by-side and find your best total comp."
        action={{
          label: 'Export PDF',
          onClick: () => window.print(),
        }}
      >
        {offers.length < 4 && (
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-teal-500 text-white text-sm font-semibold hover:bg-teal-600 transition-colors"
          >
            {showForm ? <MdClose className="text-base" /> : <MdAdd className="text-base" />}
            {showForm ? 'Cancel' : 'Add Offer'}
          </button>
        )}
      </PageHeader>

      {/* ── Add Offer Form ── */}
      {showForm && (
        <Card className="border-teal-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">New Offer Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              <Input
                placeholder="Role title *"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              />
              <Input
                placeholder="Company *"
                value={form.company}
                onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))}
              />
              <Input
                placeholder="Decision deadline (YYYY-MM-DD)"
                value={form.deadline}
                onChange={(e) => setForm((p) => ({ ...p, deadline: e.target.value }))}
              />
              <Input
                placeholder="Base salary ($)"
                type="number"
                value={form.base_salary}
                onChange={(e) => setForm((p) => ({ ...p, base_salary: e.target.value }))}
              />
              <Input
                placeholder="Bonus %"
                type="number"
                value={form.bonus_percent}
                onChange={(e) => setForm((p) => ({ ...p, bonus_percent: e.target.value }))}
              />
              <Input
                placeholder="Equity value estimate ($)"
                type="number"
                value={form.equity_value_estimate}
                onChange={(e) => setForm((p) => ({ ...p, equity_value_estimate: e.target.value }))}
              />
              <Input
                placeholder="PTO days"
                type="number"
                value={form.pto_days}
                onChange={(e) => setForm((p) => ({ ...p, pto_days: e.target.value }))}
              />
              <Input
                placeholder="Remote / Hybrid / Onsite"
                value={form.remote_type}
                onChange={(e) => setForm((p) => ({ ...p, remote_type: e.target.value }))}
              />
              <Input
                className="sm:col-span-2"
                placeholder="Benefits notes (health, 401k match, etc.)"
                value={form.benefits_notes}
                onChange={(e) => setForm((p) => ({ ...p, benefits_notes: e.target.value }))}
              />
              <div className="sm:col-span-2 md:col-span-3">
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={!form.title || !form.company || saveMutation.isPending}
                >
                  {saveMutation.isPending ? 'Saving...' : 'Save Offer'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Offer Cards Grid ── */}
      {offers.length === 0 && !showForm ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 py-12 max-w-sm mx-auto text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 text-teal-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-slate-800 text-lg">No offers yet</p>
                <p className="text-sm text-slate-500 mt-1">
                  Add offers manually using the button above, or update a job application to{' '}
                  <span className="font-semibold text-emerald-600">Offer</span> status — it will appear here automatically.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-teal-500 text-white text-sm font-semibold hover:bg-teal-600 transition-colors"
              >
                <MdAdd className="text-base" /> Add First Offer
              </button>
            </div>
          </CardContent>
        </Card>
      ) : (
        offers.length > 0 && (
          <div className={`grid gap-4 ${offers.length === 1 ? 'max-w-sm' : offers.length === 2 ? 'sm:grid-cols-2' : offers.length === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2 xl:grid-cols-4'}`}>
            {offers.slice(0, 4).map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                isTop={topOffer?.id === offer.id && offers.length > 1}
                onDelete={() => {
                  if (confirm(`Remove offer from ${offer.company}?`)) {
                    deleteMutation.mutate(offer.id)
                  }
                }}
              />
            ))}
          </div>
        )
      )}

      {/* ── Side-By-Side Comparison Table ── */}
      {offers.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Side-By-Side Comparison</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto px-4 pb-4">
              <OfferComparison offers={offers} />
            </div>
          </CardContent>
        </Card>
      )}

      {offers.length >= 4 && (
        <p className="text-xs text-center text-slate-400">Maximum 4 offers can be compared at once. Remove an offer to add a new one.</p>
      )}
    </div>
  )
}
