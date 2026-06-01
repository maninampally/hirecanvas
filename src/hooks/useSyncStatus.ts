import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type SyncStatus = {
  id: string
  status: 'idle' | 'in_progress' | 'completed' | 'failed' | 'stopped'
  total_emails: number
  processed_count: number
  new_jobs_found: number
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  updated_at: string
}

export type FailedExtractionSummary = {
  jobId: string
  subject: string | null
  reason: string
  attemptsMade: number
}

export type QueueStatus = {
  counts: { waiting: number; active: number; completed: number; failed: number; delayed: number }
  isExtracting: boolean
  failedSummaries?: FailedExtractionSummary[]
}

export function useSyncStatus(userId?: string) {
  const supabase = useMemo(() => createClient(), [])
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null)
  const [loadedUserId, setLoadedUserId] = useState<string | undefined>(undefined)

  const refreshQueue = useCallback(async () => {
    try {
      const queueRes = await fetch('/api/sync/queue', { cache: 'no-store' })
      if (queueRes.ok) {
        const queueData = (await queueRes.json()) as QueueStatus
        setQueueStatus(queueData)
      }
    } catch (err) {
      console.error('Error refreshing queue status:', err)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    if (!userId) {
      return () => {
        mounted = false
      }
    }

    const busyPollMs = 2000
    const idlePollMs = 5000
    const latestBusyRef = { current: false }

    const refreshStatus = async () => {
      try {
        const [statusRes, queueRes] = await Promise.all([
          fetch('/api/sync/status', { cache: 'no-store' }),
          fetch('/api/sync/queue', { cache: 'no-store' }),
        ])

        let nextStatus: SyncStatus | null | undefined
        let queueData: QueueStatus | undefined

        if (statusRes.ok) {
          const data = (await statusRes.json()) as { status: SyncStatus | null }
          nextStatus = data.status ?? undefined
          if (mounted) setStatus(data.status)
        }

        if (queueRes.ok) {
          queueData = (await queueRes.json()) as QueueStatus
          if (mounted) setQueueStatus(queueData)
        } else if (mounted) {
          // Avoid a stale failed count when the queue API errors mid-sync.
          setQueueStatus((prev) =>
            prev
              ? {
                  ...prev,
                  counts: { ...prev.counts, failed: 0, waiting: 0, active: 0, delayed: 0 },
                  isExtracting: false,
                  failedSummaries: [],
                }
              : null
          )
        }

        if (mounted) {
          latestBusyRef.current =
            nextStatus?.status === 'in_progress' || queueData?.isExtracting === true
        }
      } catch (err) {
        console.error('Error fetching sync status:', err)
        if (mounted) {
          setQueueStatus((prev) =>
            prev
              ? {
                  ...prev,
                  counts: { ...prev.counts, failed: 0 },
                  failedSummaries: [],
                }
              : null
          )
        }
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

    let pollTimeout: ReturnType<typeof setTimeout> | undefined

    const schedulePoll = () => {
      if (!mounted) return
      const delay = latestBusyRef.current ? busyPollMs : idlePollMs
      pollTimeout = setTimeout(async () => {
        await refreshStatus()
        schedulePoll()
      }, delay)
    }

    schedulePoll()

    return () => {
      mounted = false
      if (pollTimeout) clearTimeout(pollTimeout)
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
    refreshQueue,
  }
}
