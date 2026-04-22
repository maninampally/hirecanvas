'use client'

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { PipelineFunnelDatum } from '@/actions/dashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type PipelineFunnelProps = {
  data: PipelineFunnelDatum[]
  className?: string
}

export function PipelineFunnel({ data, className }: PipelineFunnelProps) {
  const hasData = data.some((item) => item.count > 0)

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">Pipeline Conversion Funnel</CardTitle>
        <p className="text-xs text-slate-600 mt-1">Applied to Offer conversion by stage</p>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="text-sm text-slate-600">Add applications to see your funnel conversion.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data} layout="vertical" margin={{ left: 18, right: 30, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis dataKey="stage" type="category" width={80} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1' }}
                  formatter={(value) => [`${Number(value) || 0} applications`, 'Count']}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[0, 8, 8, 0]}>
                  <LabelList dataKey="count" position="right" className="fill-slate-600 text-xs" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div className="mt-4 grid sm:grid-cols-3 gap-2">
              {data.slice(1).map((stage) => (
                <div key={stage.stage} className="rounded-lg border border-slate-200 px-3 py-2 bg-slate-50">
                  <p className="text-xs text-slate-500 uppercase font-medium">{stage.stage}</p>
                  <p className="text-sm font-semibold text-slate-900 mt-1">
                    {stage.conversionFromPrevious ?? 0}% from previous stage
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
