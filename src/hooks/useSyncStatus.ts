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

export type QueueStatus = {
  counts: { waiting: number; active: number; completed: number; failed: number; delayed: number }
  isExtracting: boolean
}

export function useSyncStatus(userId?: string) {
  const supabase = useMemo(() => createClient(), [])
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null)
  const [loadedUserId, setLoadedUserId] = useState<string | undefined>(undefined)

  useEffect(() => {
    let mounted = true

    if (!userId) {
      return () => {
        mounted = false
      }
    }

    const refreshStatus = async () => {
      try {
        const [statusRes, queueRes] = await Promise.all([
          fetch('/api/sync/status'),
          fetch('/api/sync/queue')
        ])

        if (statusRes.ok) {
          const data = (await statusRes.json()) as { status: SyncStatus | null }
          if (mounted) setStatus(data.status)
        }

        if (queueRes.ok) {
          const qData = (await queueRes.json()) as QueueStatus
          if (mounted) setQueueStatus(qData)
        }
      } catch (err) {
        console.error('Error fetching sync status:', err)
      }
    }

    const loadInitial = async () => {
      try {
        await refreshStatus()
      } finally {
        if (mounted) setLoadedUserId(userId)
      }
    }

    void loadInitial()

    const channelName = `sync-status-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const channel = supabase
      .channel(channelName)
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

    const pollId = setInterval(() => {
      void refreshStatus()
    }, 5000)

    return () => {
      mounted = false
      clearInterval(pollId)
      void supabase.removeChannel(channel)
    }
  }, [supabase, userId])

  const loading = Boolean(userId) && loadedUserId !== userId
  const visibleStatus = userId ? status : null
  const isSyncing = visibleStatus?.status === 'in_progress'
  const isExtracting = queueStatus?.isExtracting || false

  return {
    status: visibleStatus,
    queueStatus,
    loading,
    syncInProgress: isSyncing,
    extractionInProgress: isExtracting,
    isBusy: isSyncing || isExtracting,
  }
}
