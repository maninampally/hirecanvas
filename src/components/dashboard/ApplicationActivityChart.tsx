'use client'

import { useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { DateInput } from '@/components/ui/date-input'

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
  const [isCustomRange, setIsCustomRange] = useState(false)
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [showComparison, setShowComparison] = useState(false)

  const filteredData = useMemo(() => {
    let filtered = data

    if (isCustomRange && customStartDate && customEndDate) {
      filtered = data.filter((point) => {
        return point.date >= customStartDate && point.date <= customEndDate
      })
    } else {
      filtered = data.slice(-windowDays)
    }

    return filtered.map((point) => {
      const date = new Date(`${point.date}T00:00:00`)
      const shouldShowDayName = isCustomRange ? false : windowDays <= 14
      const label = shouldShowDayName
        ? point.day
        : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

      return {
        ...point,
        label,
      }
    })
  }, [data, windowDays, isCustomRange, customStartDate, customEndDate])

  const comparisonData = useMemo(() => {
    if (!showComparison || isCustomRange) return null
    const endIndex = data.length - windowDays
    const startIndex = Math.max(0, endIndex - windowDays)
    if (endIndex <= 0) return null

    const prevPeriod = data.slice(startIndex, endIndex)
    return filteredData.map((point, i) => ({
      ...point,
      previousApplications: prevPeriod[i]?.applications ?? 0,
    }))
  }, [data, filteredData, windowDays, showComparison, isCustomRange])

  return (
    <Card className={className}>
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Application Activity</CardTitle>
            <p className="text-xs text-slate-600 mt-1">Real applications over selected window.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowComparison(!showComparison)}
              className={`h-9 px-3 rounded-lg text-xs font-medium transition-colors ${
                showComparison ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Compare
            </button>
            <Select
              value={isCustomRange ? 'custom' : String(windowDays)}
              onChange={(e) => {
                const value = e.target.value
                if (value === 'custom') {
                  setIsCustomRange(true)
                } else {
                  setIsCustomRange(false)
                  setWindowDays(Number(value) as (typeof ACTIVITY_WINDOWS)[number])
                }
              }}
              className="!w-24 h-9 rounded-lg px-3 py-1 pr-8 text-xs flex-none"
            >
              {ACTIVITY_WINDOWS.map((days) => (
                <option key={days} value={days}>
                  {days}d
                </option>
              ))}
              <option value="custom">Custom</option>
            </Select>
          </div>
        </div>
        
        {isCustomRange && (
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs text-slate-600 block mb-1">Start Date</label>
              <DateInput
                value={customStartDate}
                onChange={setCustomStartDate}
                className="!h-9 text-xs"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-slate-600 block mb-1">End Date</label>
              <DateInput
                value={customEndDate}
                onChange={setCustomEndDate}
                className="!h-9 text-xs"
              />
            </div>
            <button
              onClick={() => {
                setIsCustomRange(false)
                setCustomStartDate('')
                setCustomEndDate('')
              }}
              className="h-9 px-3 text-xs rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex-none"
            >
              Clear
            </button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={comparisonData || filteredData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" minTickGap={16} />
            <YAxis allowDecimals={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#eef2ff',
                border: '1px solid #c7d2fe',
                borderRadius: 12,
              }}
              formatter={(value, name) => [
                `${value} applications`,
                name === 'previousApplications' ? 'Previous Period' : 'Applications',
              ]}
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
            {comparisonData && (
              <Line
                dataKey="previousApplications"
                type="monotone"
                stroke="#94a3b8"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                isAnimationActive={true}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
