'use client'

import { useState } from 'react'
import { getWeeklyStrategyReport, type WeeklyStrategyReport as WeeklyStrategyReportData } from '@/actions/dashboard'
import { useAuthStore } from '@/stores/authStore'
import { TierGate } from '@/components/ui/TierGate'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

type WeeklyStrategyReportProps = {
  initialInsights?: string[]
  className?: string
}

export function WeeklyStrategyReport({ initialInsights = [], className }: WeeklyStrategyReportProps) {
  const { user } = useAuthStore()
  const [data, setData] = useState<WeeklyStrategyReportData | null>(
    initialInsights.length > 0
      ? {
          insights: initialInsights,
          provider: 'cached',
          model: 'cached',
        }
      : null
  )
  const [isLoading, setIsLoading] = useState(false)

  async function handleGenerate() {
    try {
      setIsLoading(true)
      const report = await getWeeklyStrategyReport()
      setData(report)
      toast.success('Weekly strategy report generated')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to generate strategy report')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">Weekly Strategy Report</CardTitle>
        <p className="text-xs text-slate-600 mt-1">AI-generated next steps from your live pipeline data</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <TierGate
          currentTier={user?.tier}
          allowedTiers={['elite', 'admin']}
          fallback={<p className="text-sm text-slate-600">Upgrade to Elite to unlock weekly AI strategy reports.</p>}
        >
          <Button onClick={handleGenerate} disabled={isLoading}>
            {isLoading ? 'Generating...' : 'Generate This Week Report'}
          </Button>

          {data && (
            <div className="space-y-3 pt-1 animate-slide-up">
              <div className="flex items-center gap-2">
                <Badge variant="teal">Elite</Badge>
                <p className="text-xs text-slate-500">Provider: {data.provider}</p>
              </div>
              <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1.5">
                {data.insights.map((insight) => (
                  <li key={insight}>{insight}</li>
                ))}
              </ul>
            </div>
          )}
        </TierGate>
      </CardContent>
    </Card>
  )
}
