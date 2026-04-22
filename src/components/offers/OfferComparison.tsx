'use client'

import { OfferRow } from '@/actions/offers'

type Props = {
  offers: OfferRow[]
}

function totalComp(offer: OfferRow) {
  const base = Number(offer.base_salary || 0)
  const equity = Number(offer.equity_value_estimate || 0)
  const bonus = base * (Number(offer.bonus_percent || 0) / 100)
  return Math.round(base + equity + bonus)
}

export function OfferComparison({ offers }: Props) {
  const visibleOffers = offers.slice(0, 4)

  if (visibleOffers.length === 0) {
    return <p className="text-sm text-slate-500">No offers yet. Add one from a job with Offer status.</p>
  }

  const topBase = Math.max(...visibleOffers.map((o) => Number(o.base_salary || 0)))
  const topBonus = Math.max(...visibleOffers.map((o) => Number(o.bonus_percent || 0)))
  const topEquity = Math.max(...visibleOffers.map((o) => Number(o.equity_value_estimate || 0)))
  const topPto = Math.max(...visibleOffers.map((o) => Number(o.pto_days || 0)))
  const topTotal = Math.max(...visibleOffers.map((o) => totalComp(o)))

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] border-separate border-spacing-y-2 print:min-w-0">
        <thead>
          <tr className="text-left text-xs uppercase text-slate-500">
            <th className="px-3 py-2">Offer</th>
            <th className="px-3 py-2">Base Salary</th>
            <th className="px-3 py-2">Bonus %</th>
            <th className="px-3 py-2">Equity Value</th>
            <th className="px-3 py-2">PTO</th>
            <th className="px-3 py-2">Remote</th>
            <th className="px-3 py-2">Total Comp</th>
          </tr>
        </thead>
        <tbody>
          {visibleOffers.map((offer) => {
            const base = Number(offer.base_salary || 0)
            const bonus = Number(offer.bonus_percent || 0)
            const equity = Number(offer.equity_value_estimate || 0)
            const pto = Number(offer.pto_days || 0)
            const total = totalComp(offer)
            return (
              <tr key={offer.id} className="bg-white shadow-sm print:shadow-none">
                <td className="rounded-l-lg px-3 py-3">
                  <p className="font-semibold text-slate-800">{offer.company}</p>
                  <p className="text-xs text-slate-500">{offer.title}</p>
                </td>
                <td className={`px-3 py-3 ${base === topBase ? 'bg-emerald-50 font-semibold text-emerald-700' : ''}`}>
                  ${base.toLocaleString()}
                </td>
                <td className={`px-3 py-3 ${bonus === topBonus ? 'bg-emerald-50 font-semibold text-emerald-700' : ''}`}>
                  {bonus}%
                </td>
                <td className={`px-3 py-3 ${equity === topEquity ? 'bg-emerald-50 font-semibold text-emerald-700' : ''}`}>
                  ${equity.toLocaleString()}
                </td>
                <td className={`px-3 py-3 ${pto === topPto ? 'bg-emerald-50 font-semibold text-emerald-700' : ''}`}>
                  {pto} days
                </td>
                <td className="px-3 py-3">{offer.remote_type || 'N/A'}</td>
                <td className={`rounded-r-lg px-3 py-3 ${total === topTotal ? 'bg-emerald-50 font-semibold text-emerald-700' : ''}`}>
                  ${total.toLocaleString()}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

