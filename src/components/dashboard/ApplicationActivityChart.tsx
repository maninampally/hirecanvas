'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

const chartData = [
  { day: 'Mon', applications: 2 },
  { day: 'Tue', applications: 3 },
  { day: 'Wed', applications: 1 },
  { day: 'Thu', applications: 4 },
  { day: 'Fri', applications: 8 },
  { day: 'Sat', applications: 0 },
  { day: 'Sun', applications: 0 },
]

type ApplicationActivityChartProps = {
  className?: string
}

export function ApplicationActivityChart({ className }: ApplicationActivityChartProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">Application Activity</CardTitle>
        <p className="text-xs text-slate-600 mt-1">Last 7 days</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="day" />
            <YAxis />
            <Tooltip
              contentStyle={{ backgroundColor: '#f0fdfb', border: '1px solid #ccfbf1' }}
              formatter={(value) => [`${value} applications`, 'Applications']}
            />
            <Bar
              dataKey="applications"
              fill="#14b8a6"
              radius={[8, 8, 0, 0]}
              isAnimationActive={true}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
