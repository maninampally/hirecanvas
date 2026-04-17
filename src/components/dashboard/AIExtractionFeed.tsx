'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const activities = [
  {
    id: 1,
    type: 'extracted',
    title: 'Extracted application',
    company: 'Google',
    time: '2 hours ago',
    color: 'bg-teal-500',
  },
  {
    id: 2,
    type: 'interview',
    title: 'Interview scheduled',
    company: 'Meta',
    time: '4 hours ago',
    color: 'bg-violet-500',
  },
  {
    id: 3,
    type: 'offer',
    title: 'Offer packet detected',
    company: 'Stripe',
    time: '1 day ago',
    color: 'bg-emerald-500',
  },
  {
    id: 4,
    type: 'sanitized',
    title: 'PII sanitization applied',
    company: 'Amazon',
    time: '2 days ago',
    color: 'bg-blue-500',
  },
]

type AIExtractionFeedProps = {
  className?: string
}

export function AIExtractionFeed({ className }: AIExtractionFeedProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">AI Extraction Feed</CardTitle>
        <p className="text-xs text-slate-600 mt-1">Recent parsed emails</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start gap-3 pb-3 border-b border-slate-200 last:border-0 last:pb-0">
              <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${activity.color}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900">{activity.title}</p>
                <p className="text-xs text-slate-600">
                  {activity.company} • {activity.time}
                </p>
              </div>
            </div>
          ))}
        </div>
        <Button variant="outline" className="w-full mt-4 text-xs">
          View full sync log →
        </Button>
      </CardContent>
    </Card>
  )
}
