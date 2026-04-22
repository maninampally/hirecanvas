'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'

export default function OnboardingPage() {
  return (
    <div className="space-y-6 animate-slide-up">
      <PageHeader
        title="Onboarding"
        description="Complete setup to get the most out of HireCanvas."
      />
      <Card>
        <CardContent className="pt-6 space-y-4">
          <p className="text-sm text-slate-600">
            Setup is available directly in your dashboard checklist.
          </p>
          <Link href="/dashboard">
            <Button>Back to Dashboard</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

