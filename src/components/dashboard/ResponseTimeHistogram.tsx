'use client'

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export type ResponseTimeBucket = {
  bucket: string
  count: number
}

type ResponseTimeHistogramProps = {
  data: ResponseTimeBucket[]
  className?: string
}

export function ResponseTimeHistogram({ data, className }: ResponseTimeHistogramProps) {
  const hasData = data.some((d) => d.count > 0)

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">Response Time Distribution</CardTitle>
        <p className="text-xs text-slate-600 mt-1">How quickly companies respond after applying</p>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="text-sm text-slate-600">No response time data available yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} margin={{ left: 0, right: 10, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8 }} formatter={(v) => [`${v} jobs`, 'Count']} />
              <Bar dataKey="count" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
