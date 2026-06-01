import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#ecfeff_0%,_#f8fafc_50%,_#f8fafc_100%)] flex items-center justify-center p-6">
      <Card className="w-full max-w-xl border-slate-200 shadow-teal-md">
        <CardContent className="pt-8 pb-8 space-y-5 text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-sm">
            404
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Page not found</h1>
          <p className="text-sm text-slate-600">
            The page you are looking for does not exist or has been moved.
          </p>
          <div className="flex items-center justify-center gap-2">
            <Link href="/dashboard">
              <Button>Back to Dashboard</Button>
            </Link>
            <Link href="/">
              <Button variant="outline">Go Home</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

