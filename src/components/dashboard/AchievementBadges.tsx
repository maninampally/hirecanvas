'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type AchievementItem = {
  key: string
  label: string
  unlocked: boolean
}

type AchievementBadgesProps = {
  achievements: AchievementItem[]
}

export function AchievementBadges({ achievements }: AchievementBadgesProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Achievements</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-2">
        {achievements.map((achievement) => (
          <div
            key={achievement.key}
            className={`rounded-lg border px-3 py-2 text-sm ${
              achievement.unlocked
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-slate-50 text-slate-500'
            }`}
          >
            {achievement.unlocked ? 'Unlocked: ' : 'Locked: '}
            {achievement.label}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

