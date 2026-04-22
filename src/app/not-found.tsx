import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#f5f6ff] flex items-center justify-center p-6">
      <Card className="w-full max-w-xl">
        <CardContent className="pt-8 pb-8 space-y-5 text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
            404
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Page not found</h1>
          <p className="text-sm text-slate-600">
            The page you are looking for does not exist or has been moved.
          </p>
          <Link href="/">
            <Button>Back to Dashboard</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

