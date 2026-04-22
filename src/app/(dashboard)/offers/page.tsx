'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getOffers, upsertOffer } from '@/actions/offers'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { OfferComparison } from '@/components/offers/OfferComparison'
import { toast } from 'sonner'

export default function OffersPage() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    title: '',
    company: '',
    base_salary: '',
    bonus_percent: '',
    equity_value_estimate: '',
    pto_days: '',
    remote_type: '',
    benefits_notes: '',
  })

  const offersQuery = useQuery({
    queryKey: ['offers'],
    queryFn: getOffers,
  })

  const saveMutation = useMutation({
    mutationFn: async () =>
      upsertOffer({
        title: form.title,
        company: form.company,
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
      setForm({
        title: '',
        company: '',
        base_salary: '',
        bonus_percent: '',
        equity_value_estimate: '',
        pto_days: '',
        remote_type: '',
        benefits_notes: '',
      })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Unable to save offer')
    },
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Offer Comparison"
        description="Compare up to 4 offers side-by-side."
        action={{
          label: 'Export PDF',
          onClick: () => window.print(),
        }}
      />

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3">
        <Input placeholder="Role title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
        <Input placeholder="Company" value={form.company} onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))} />
        <Input placeholder="Base salary" type="number" value={form.base_salary} onChange={(e) => setForm((p) => ({ ...p, base_salary: e.target.value }))} />
        <Input placeholder="Bonus %" type="number" value={form.bonus_percent} onChange={(e) => setForm((p) => ({ ...p, bonus_percent: e.target.value }))} />
        <Input placeholder="Equity value estimate" type="number" value={form.equity_value_estimate} onChange={(e) => setForm((p) => ({ ...p, equity_value_estimate: e.target.value }))} />
        <Input placeholder="PTO days" type="number" value={form.pto_days} onChange={(e) => setForm((p) => ({ ...p, pto_days: e.target.value }))} />
        <Input placeholder="Remote / Hybrid / Onsite" value={form.remote_type} onChange={(e) => setForm((p) => ({ ...p, remote_type: e.target.value }))} />
        <Input className="md:col-span-2" placeholder="Benefits notes" value={form.benefits_notes} onChange={(e) => setForm((p) => ({ ...p, benefits_notes: e.target.value }))} />
        <div className="md:col-span-3">
          <Button onClick={() => saveMutation.mutate()} disabled={!form.title || !form.company || saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving...' : 'Save Offer'}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 print:bg-white print:border-0 print:p-0">
        <OfferComparison offers={offersQuery.data || []} />
      </div>
    </div>
  )
}

