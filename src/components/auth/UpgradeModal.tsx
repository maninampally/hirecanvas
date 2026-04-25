'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

type UpgradeModalProps = {
  open: boolean
  onClose: () => void
  feature?: string
}

const FEATURE_COPY: Record<string, { title: string; description: string }> = {
  cover_letter: {
    title: 'AI Cover Letter Writer is Elite-only',
    description: 'Generate tailored, AI-written cover letters from your resume and job description.',
  },
  strategy_report: {
    title: 'Weekly Strategy Report is Elite-only',
    description: 'Get AI-generated next steps and coaching based on your live pipeline data.',
  },
  sync: {
    title: 'Auto-sync is Pro+',
    description: 'Automatically sync your Gmail inbox and extract job emails with AI.',
  },
}

const DEFAULT_COPY = {
  title: 'Upgrade to unlock this feature',
  description: 'Pro and Elite plans include Gmail auto-sync, AI extraction, and advanced automation.',
}

export function UpgradeModal({ open, onClose, feature }: UpgradeModalProps) {
  const router = useRouter()
  const copy = (feature && FEATURE_COPY[feature]) || DEFAULT_COPY

  if (!open) return null

  function handleGoToBilling() {
    onClose()
    router.push('/billing')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900">{copy.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{copy.description}</p>
          </div>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-900">Pro</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">$9.99/mo</p>
            <ul className="mt-3 space-y-1 text-sm text-slate-600">
              <li>3 auto syncs/day</li>
              <li>Gemini AI extraction</li>
              <li>Follow-up nudges</li>
              <li>Unlimited contacts</li>
            </ul>
          </div>

          <div className="rounded-lg border border-teal-300 bg-teal-50 p-4">
            <p className="text-sm font-semibold text-teal-800">Elite</p>
            <p className="mt-1 text-2xl font-bold text-teal-900">$29.99/mo</p>
            <ul className="mt-3 space-y-1 text-sm text-teal-800">
              <li>Unlimited syncs</li>
              <li>Claude AI extraction</li>
              <li>AI cover letters</li>
              <li>Weekly strategy report</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Maybe Later
          </Button>
          <Button onClick={handleGoToBilling}>Go to Billing</Button>
        </div>
      </div>
    </div>
  )
}
