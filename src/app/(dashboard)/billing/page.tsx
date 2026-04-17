'use client'

import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export default function BillingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Billing</h1>
        <p className="text-slate-600 mt-1">Manage your subscription and billing</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-slate-600">Plan</p>
            <p className="text-lg font-semibold">Free</p>
          </div>
          <p className="text-sm text-slate-600">Upgrade to Pro ($9.99/mo) or Elite ($29.99/mo) for more features</p>
          <Button>Upgrade Now</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Billing History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-600">No billing history yet</p>
        </CardContent>
      </Card>
    </div>
  )
}
