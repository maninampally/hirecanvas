import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type SyncStatus = {
  id: string
  status: 'idle' | 'in_progress' | 'completed' | 'failed'
  total_emails: number
  processed_count: number
  new_jobs_found: number
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  updated_at: string
}

export function useSyncStatus(userId?: string) {
  const supabase = useMemo(() => createClient(), [])
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const loadInitial = async () => {
      try {
        const response = await fetch('/api/sync/status')
        if (!response.ok) return

        const data = (await response.json()) as { status: SyncStatus | null }
        if (mounted) {
          setStatus(data.status)
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void loadInitial()

    if (!userId) {
      return () => {
        mounted = false
      }
    }

    const channel = supabase
      .channel(`sync-status-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sync_status',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const nextRow = (payload.new || payload.old) as SyncStatus | undefined
          if (!nextRow) return

          setStatus((prev) => {
            if (!prev) return nextRow
            return new Date(nextRow.updated_at) >= new Date(prev.updated_at) ? nextRow : prev
          })
        }
      )
      .subscribe()

    return () => {
      mounted = false
      void supabase.removeChannel(channel)
    }
  }, [supabase, userId])

  return {
    status,
    loading,
    syncInProgress: status?.status === 'in_progress',
  }
}
