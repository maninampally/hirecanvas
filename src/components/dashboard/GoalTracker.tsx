'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type GoalTrackerProps = {
  weeklyTarget: number
  weeklyCompleted: number
  currentStreak: number
  longestStreak: number
}

export function GoalTracker({
  weeklyTarget,
  weeklyCompleted,
  currentStreak,
  longestStreak,
}: GoalTrackerProps) {
  const progress = Math.min(100, Math.round((weeklyCompleted / Math.max(1, weeklyTarget)) * 100))
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Weekly Goal Tracker</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
            <span>
              {weeklyCompleted}/{weeklyTarget} applications
            </span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-indigo-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase text-slate-500">Current Streak</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{currentStreak} day(s)</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase text-slate-500">Longest Streak</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{longestStreak} day(s)</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

