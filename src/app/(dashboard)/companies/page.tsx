'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getCompanies, type CompanyStats } from '@/actions/companies'
import { exportToCsv } from '@/lib/csvExport'
import { toast } from 'sonner'

type SortKey = 'company' | 'totalApplications' | 'interviewRate' | 'avgResponseDays'
type SortDir = 'asc' | 'desc'

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className={`ml-1 inline-block transition-opacity ${active ? 'opacity-100' : 'opacity-30'}`}>
      {dir === 'asc' ? '↑' : '↓'}
    </span>
  )
}

function SkeletonRows() {
  return (
    <>
      {[1, 2, 3, 4].map((i) => (
        <tr key={i} className="border-b border-slate-100">
          {[1, 2, 3, 4, 5].map((j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 rounded bg-slate-100 animate-pulse" style={{ width: j === 1 ? '120px' : j === 5 ? '80px' : '60px' }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export default function CompaniesPage() {
  const router = useRouter()
  const [companies, setCompanies] = useState<CompanyStats[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('totalApplications')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  useEffect(() => {
    getCompanies()
      .then(setCompanies)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
        return prev
      }
      setSortDir('desc')
      return key
    })
  }, [])

  const sorted = [...companies].sort((a, b) => {
    let aVal: string | number = a[sortKey] ?? ''
    let bVal: string | number = b[sortKey] ?? ''
    if (typeof aVal === 'string') aVal = aVal.toLowerCase()
    if (typeof bVal === 'string') bVal = bVal.toLowerCase()
    if (aVal === null || aVal === '') return 1
    if (bVal === null || bVal === '') return -1
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const th = (label: string, key: SortKey) => (
    <th
      className="px-4 py-3 text-left cursor-pointer select-none hover:text-slate-700 transition-colors"
      onClick={() => handleSort(key)}
    >
      {label}
      <SortIcon active={sortKey === key} dir={sortDir} />
    </th>
  )

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Companies</h1>
          <p className="text-slate-500 mt-1">Aggregated view of all companies you&apos;ve applied to</p>
        </div>
        <button
          type="button"
          onClick={() => {
            const rows = companies.map((c) => ({
              Company: c.company,
              'Total Applications': c.totalApplications,
              'Interview Rate (%)': c.interviewRate,
              'Avg Response (days)': c.avgResponseDays ?? '',
              Statuses: Object.entries(c.statuses).map(([k, v]) => `${k}:${v}`).join(' | '),
            }))
            exportToCsv(`companies-${new Date().toISOString().slice(0, 10)}`, rows)
            toast.success(`Exported ${rows.length} companies`)
          }}
          disabled={companies.length === 0}
          className="h-9 px-4 rounded-md border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-1.5 disabled:opacity-40"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export CSV
        </button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Company Overview</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    <th className="px-4 py-3 text-left">Company</th>
                    <th className="px-4 py-3 text-left">Applications</th>
                    <th className="px-4 py-3 text-left">Interview Rate</th>
                    <th className="px-4 py-3 text-left">Avg Response</th>
                    <th className="px-4 py-3 text-left">Statuses</th>
                  </tr>
                </thead>
                <tbody><SkeletonRows /></tbody>
              </table>
            </div>
          ) : companies.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 max-w-sm mx-auto text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 text-teal-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <p className="font-semibold text-slate-800 text-base">No company data yet</p>
              <p className="text-sm text-slate-500">Start tracking applications to see aggregated company analytics here.</p>
              <button
                type="button"
                onClick={() => router.push('/applications')}
                className="mt-1 rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-600 transition-colors"
              >
                View Applications
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    {th('Company', 'company')}
                    {th('Applications', 'totalApplications')}
                    {th('Interview Rate', 'interviewRate')}
                    <th className="px-4 py-3 text-left hidden md:table-cell cursor-pointer select-none hover:text-slate-700 transition-colors" onClick={() => handleSort('avgResponseDays')}>
                      Avg Response<SortIcon active={sortKey === 'avgResponseDays'} dir={sortDir} />
                    </th>
                    <th className="px-4 py-3 text-left hidden lg:table-cell">Statuses</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sorted.map((company) => (
                    <tr
                      key={company.company}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                      onClick={() => router.push(`/applications?company=${encodeURIComponent(company.company)}`)}
                      title={`View all applications for ${company.company}`}
                    >
                      <td className="px-4 py-3 font-semibold text-slate-900 text-sm">{company.company}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{company.totalApplications}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={company.interviewRate > 0 ? 'text-emerald-600 font-medium' : 'text-slate-400'}>
                          {company.interviewRate}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 hidden md:table-cell">
                        {company.avgResponseDays != null ? `${company.avgResponseDays}d` : '—'}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(company.statuses).map(([status, count]) => {
                            const variant: Record<string, 'amber' | 'blue' | 'emerald' | 'rose' | 'teal'> = {
                              Wishlist: 'teal', Applied: 'blue', Screening: 'amber',
                              Interview: 'amber', Offer: 'emerald', Rejected: 'rose',
                            }
                            return (
                              <Badge key={status} variant={variant[status] || 'teal'} className="text-[10px]">
                                {status} ({count})
                              </Badge>
                            )
                          })}
                        </div>
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
