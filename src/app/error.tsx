'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f5f6ff] flex items-center justify-center p-6">
        <Card className="w-full max-w-xl">
          <CardContent className="pt-8 pb-8 space-y-5 text-center">
            <div className="mx-auto h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 text-white flex items-center justify-center font-bold">
              !
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Something went wrong</h1>
            <p className="text-sm text-slate-600">
              We hit an unexpected error. You can retry now or go back home.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button onClick={reset}>Try Again</Button>
              <Link href="/">
                <Button variant="outline">Go Home</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </body>
    </html>
  )
}

