'use client'

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export type SourceBreakdownDatum = {
  source: string
  applied: number
  interview: number
  offer: number
  rejected: number
}

type SourceBreakdownProps = {
  data: SourceBreakdownDatum[]
  className?: string
}

export function SourceBreakdown({ data, className }: SourceBreakdownProps) {
  const hasData = data.length > 0

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">Source Effectiveness</CardTitle>
        <p className="text-xs text-slate-600 mt-1">Applications by source, colored by outcome</p>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="text-sm text-slate-600">No source data available yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis dataKey="source" type="category" width={90} tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8 }} />
              <Legend />
              <Bar dataKey="applied" stackId="a" fill="#60a5fa" name="Applied" />
              <Bar dataKey="interview" stackId="a" fill="#fbbf24" name="Interview" />
              <Bar dataKey="offer" stackId="a" fill="#34d399" name="Offer" />
              <Bar dataKey="rejected" stackId="a" fill="#fb7185" name="Rejected" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
