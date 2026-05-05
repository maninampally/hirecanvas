'use client'

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export type SalaryDatum = {
  status: string
  min: number
  max: number
  count: number
}

type SalaryAnalyticsProps = {
  data: SalaryDatum[]
  className?: string
}

function formatK(value: number) {
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`
  return `$${value}`
}

export function SalaryAnalytics({ data, className }: SalaryAnalyticsProps) {
  const hasData = data.some((d) => d.count > 0)

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">Salary Ranges by Status</CardTitle>
        <p className="text-xs text-slate-600 mt-1">Min/max salary bands from job listings</p>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="text-sm text-slate-600">No salary data available. Add salary ranges to your applications.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} margin={{ left: 10, right: 10, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="status" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={formatK} />
              <Tooltip contentStyle={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8 }} formatter={(v) => [formatK(Number(v)), '']} />
              <Legend />
              <Bar dataKey="min" fill="#6ee7b7" name="Min Salary" radius={[4, 4, 0, 0]} />
              <Bar dataKey="max" fill="#34d399" name="Max Salary" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
