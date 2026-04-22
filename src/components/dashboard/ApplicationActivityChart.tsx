'use client'

import { useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Select } from '@/components/ui/select'

export type ApplicationActivityPoint = {
  date: string
  day: string
  applications: number
}

type ApplicationActivityChartProps = {
  data: ApplicationActivityPoint[]
  className?: string
}

const ACTIVITY_WINDOWS = [7, 14, 30] as const

export function ApplicationActivityChart({ data, className }: ApplicationActivityChartProps) {
  const [windowDays, setWindowDays] = useState<(typeof ACTIVITY_WINDOWS)[number]>(7)

  const filteredData = useMemo(() => {
    const recent = data.slice(-windowDays)
    return recent.map((point) => {
      const date = new Date(`${point.date}T00:00:00`)
      const label =
        windowDays <= 14
          ? point.day
          : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

      return {
        ...point,
        label,
      }
    })
  }, [data, windowDays])

  return (
    <Card className={className}>
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Application Activity</CardTitle>
            <p className="text-xs text-slate-600 mt-1">Real applications over selected window.</p>
          </div>
          <Select
            value={String(windowDays)}
            onChange={(e) => setWindowDays(Number(e.target.value) as (typeof ACTIVITY_WINDOWS)[number])}
            className="!w-20 h-9 rounded-lg px-3 py-1 pr-8 text-xs flex-none"
          >
            {ACTIVITY_WINDOWS.map((days) => (
              <option key={days} value={days}>
                {days}d
              </option>
            ))}
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={filteredData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" minTickGap={16} />
            <YAxis allowDecimals={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#eef2ff',
                border: '1px solid #c7d2fe',
                borderRadius: 12,
              }}
              formatter={(value) => [`${value} applications`, 'Applications']}
              labelFormatter={(label, payload) => {
                const item = payload?.[0]?.payload as { date?: string } | undefined
                if (!item?.date) return String(label)
                return new Date(`${item.date}T00:00:00`).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })
              }}
            />
            <Line
              dataKey="applications"
              type="monotone"
              stroke="#6366f1"
              strokeWidth={3}
              dot={{ r: 3, fill: '#6366f1' }}
              activeDot={{ r: 5 }}
              isAnimationActive={true}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
