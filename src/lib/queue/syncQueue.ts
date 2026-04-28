import { Queue } from 'bullmq'
import { defaultJobOptions, queueConnection } from '@/lib/queue/connection'

export const SYNC_QUEUE_NAME = 'gmail-sync'

export type SyncJobPayload = {
  userId: string
  trigger: 'manual' | 'daily_cron'
  force?: boolean
  fromDate?: string
  toDate?: string
  timezoneOffsetMinutes?: number
  /**
   * Per-job extraction mode override. The trigger route auto-selects
   * `high_precision` for backfills longer than 30 days; otherwise the
   * sync inherits the env-driven default in `getExtractionConfig()`.
   */
  extractionMode?: 'balanced' | 'high_recall' | 'high_precision'
}

let syncQueue: Queue<SyncJobPayload> | null = null

export function getSyncQueue() {
  if (!syncQueue) {
    syncQueue = new Queue<SyncJobPayload>(SYNC_QUEUE_NAME, {
      connection: queueConnection,
      defaultJobOptions,
    })
  }

  return syncQueue
}

export async function enqueueSyncJob(payload: SyncJobPayload) {
  const queue = getSyncQueue()
  return queue.add(`sync:${payload.userId}:${Date.now()}`, payload)
}
