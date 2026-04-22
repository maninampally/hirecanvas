'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type OnboardingChecklistProps = {
  hasGmailConnected: boolean
  hasCreatedJob: boolean
  hasRunSync: boolean
  onSkip: () => Promise<void> | void
}

export function OnboardingChecklist({
  hasGmailConnected,
  hasCreatedJob,
  hasRunSync,
  onSkip,
}: OnboardingChecklistProps) {
  const steps = [
    {
      id: 'gmail',
      label: 'Connect Gmail',
      done: hasGmailConnected,
      href: '/settings',
      cta: 'Open Settings',
    },
    {
      id: 'job',
      label: 'Add your first job',
      done: hasCreatedJob,
      href: '/jobs',
      cta: 'Go to Jobs',
    },
    {
      id: 'sync',
      label: 'Run your first inbox sync',
      done: hasRunSync,
      href: '/',
      cta: 'Go to Dashboard',
    },
  ] as const

  const completedCount = steps.filter((step) => step.done).length

  return (
    <Card className="border-indigo-100 bg-white/85 backdrop-blur-sm animate-slide-down">
      <CardContent className="pt-5">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Welcome to HireCanvas</h2>
              <p className="text-sm text-slate-600 mt-1">
                Complete these steps to unlock the full workflow.
              </p>
            </div>
            <Badge variant="violet">
              {completedCount}/{steps.length} complete
            </Badge>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {steps.map((step) => (
              <div
                key={step.id}
                className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800">{step.label}</p>
                  <Badge variant={step.done ? 'emerald' : 'slate'}>
                    {step.done ? 'Done' : 'Pending'}
                  </Badge>
                </div>
                {!step.done && (
                  <Link href={step.href}>
                    <Button size="sm" variant="outline" className="w-full">
                      {step.cta}
                    </Button>
                  </Link>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => void onSkip()}>
              Skip for now
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

