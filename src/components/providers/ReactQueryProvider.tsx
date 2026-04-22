'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { SupabaseRealtimeBridge } from '@/components/providers/SupabaseRealtimeBridge'

export function ReactQueryProvider({
  children,
  userId,
}: {
  children: React.ReactNode
  userId?: string
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 0,
            refetchOnMount: 'always',
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <SupabaseRealtimeBridge userId={userId} />
      {children}
    </QueryClientProvider>
  )
}
