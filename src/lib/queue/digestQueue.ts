import { Queue } from 'bullmq'
import { defaultJobOptions, queueConnection } from '@/lib/queue/connection'

export const DIGEST_QUEUE_NAME = 'daily-digest'

export type DigestJobPayload = {
  userId?: string
  trigger: 'manual' | 'daily_cron'
}

let digestQueue: Queue<DigestJobPayload> | null = null

export function getDigestQueue() {
  if (!digestQueue) {
    digestQueue = new Queue<DigestJobPayload>(DIGEST_QUEUE_NAME, {
      connection: queueConnection,
      defaultJobOptions,
    })
  }

  return digestQueue
}

export async function enqueueDigestJob(payload: DigestJobPayload) {
  const queue = getDigestQueue()
  return queue.add(`digest:${payload.userId || 'all'}:${Date.now()}`, payload)
}
