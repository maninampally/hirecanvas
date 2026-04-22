'use client'

import type { ResponseRateDatum } from '@/actions/dashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type ResponseRateAnalyticsProps = {
  data: ResponseRateDatum[]
  className?: string
}

export function ResponseRateAnalytics({ data, className }: ResponseRateAnalyticsProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">Response Rate Analytics</CardTitle>
        <p className="text-xs text-slate-600 mt-1">Average days to first response by company</p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-slate-600">No response timing data available yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200">
                  <th className="py-2 text-left">Company</th>
                  <th className="py-2 text-left">Avg Response</th>
                  <th className="py-2 text-left">Responses</th>
                  <th className="py-2 text-left">Total Jobs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((row) => (
                  <tr key={row.company} className="text-sm">
                    <td className="py-2.5 font-medium text-slate-900">{row.company}</td>
                    <td className="py-2.5 text-slate-700">{row.avgDaysToResponse.toFixed(1)} days</td>
                    <td className="py-2.5 text-slate-600">{row.responses}</td>
                    <td className="py-2.5 text-slate-600">{row.totalJobs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
