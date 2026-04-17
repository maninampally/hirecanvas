import { Button } from '@/components/ui/button'

type UpgradeModalProps = {
  open: boolean
  onClose: () => void
}

export function UpgradeModal({ open, onClose }: UpgradeModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Upgrade to unlock auto-sync</h3>
            <p className="mt-1 text-sm text-slate-600">
              Pro and Elite plans include Gmail auto-sync and extraction workflows.
            </p>
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
              <li>3 syncs per day</li>
              <li>Gmail extraction pipeline</li>
              <li>Follow-up support features</li>
            </ul>
          </div>

          <div className="rounded-lg border border-teal-300 bg-teal-50 p-4">
            <p className="text-sm font-semibold text-teal-800">Elite</p>
            <p className="mt-1 text-2xl font-bold text-teal-900">$29.99/mo</p>
            <ul className="mt-3 space-y-1 text-sm text-teal-800">
              <li>Higher sync throughput</li>
              <li>Priority AI workflow access</li>
              <li>Advanced automation tools</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Maybe Later
          </Button>
          <Button onClick={onClose}>Go to Billing</Button>
        </div>
      </div>
    </div>
  )
}
