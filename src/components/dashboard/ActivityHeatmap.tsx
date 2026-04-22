'use client'

import type { ActivityHeatmapCell } from '@/actions/dashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type ActivityHeatmapProps = {
  cells: ActivityHeatmapCell[]
  className?: string
}

function colorForIntensity(intensity: number) {
  if (intensity <= 0) return 'bg-slate-100'
  if (intensity < 0.25) return 'bg-indigo-100'
  if (intensity < 0.5) return 'bg-indigo-200'
  if (intensity < 0.75) return 'bg-indigo-400'
  return 'bg-indigo-500'
}

export function ActivityHeatmap({ cells, className }: ActivityHeatmapProps) {
  const hasData = cells.some((cell) => cell.count > 0)

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">Application Activity</CardTitle>
        <p className="text-xs text-slate-600 mt-1">Last 52 weeks of application activity</p>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="text-sm text-slate-600">No application activity yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="grid grid-flow-col gap-1 min-w-[820px]">
              {Array.from({ length: 52 }).map((_, weekIndex) => (
                <div key={weekIndex} className="grid grid-rows-7 gap-1">
                  {cells
                    .filter((cell) => cell.weekIndex === weekIndex)
                    .map((cell) => (
                      <div
                        key={`${cell.weekIndex}-${cell.dayIndex}`}
                        className={`w-3.5 h-3.5 rounded-sm ${colorForIntensity(cell.intensity)} border border-white/40`}
                        title={`${cell.date}: ${cell.count} applications`}
                      />
                    ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
