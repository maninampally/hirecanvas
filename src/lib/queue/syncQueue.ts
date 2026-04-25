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
