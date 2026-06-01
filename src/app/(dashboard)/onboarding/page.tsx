'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'

export default function OnboardingPage() {
  const [step, setStep] = useState(0)

  const steps = useMemo(
    () => [
      {
        title: 'Connect your inbox',
        description:
          'Link Gmail first so HireCanvas can auto-sync applications and update statuses from real email activity.',
        ctaLabel: 'Open Connections',
        href: '/settings?tab=connections',
      },
      {
        title: 'Set your first target',
        description:
          'Pick weekly application and outreach goals so your dashboard insights and reminders stay meaningful.',
        ctaLabel: 'Open Dashboard',
        href: '/dashboard',
      },
      {
        title: 'Upload core documents',
        description:
          'Add your primary resume and templates now to speed up application and outreach workflows later.',
        ctaLabel: 'Open Resumes',
        href: '/resumes',
      },
    ],
    []
  )

  const current = steps[step]
  const isLastStep = step === steps.length - 1

  return (
    <div className="space-y-6 animate-slide-up">
      <PageHeader
        title="Onboarding"
        description="Complete the setup checklist to unlock your full job search workflow."
      />
      <Card>
        <CardContent className="pt-6 space-y-5">
          <div className="flex items-center gap-2">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`h-2.5 flex-1 rounded-full transition-colors ${
                  index <= step ? 'bg-teal-500' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Step {step + 1} of {steps.length}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">{current.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{current.description}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href={current.href}>
              <Button>{current.ctaLabel}</Button>
            </Link>
            {!isLastStep ? (
              <Button variant="outline" onClick={() => setStep((s) => Math.min(s + 1, steps.length - 1))}>
                Mark as done
              </Button>
            ) : (
              <Link href="/dashboard">
                <Button variant="outline">Finish onboarding</Button>
              </Link>
            )}
          </div>

          <p className="text-xs text-slate-500">
            Tip: you can revisit onboarding anytime from the sidebar.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

