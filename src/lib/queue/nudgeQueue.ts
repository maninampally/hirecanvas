import { Queue } from 'bullmq'
import { defaultJobOptions, queueConnection } from '@/lib/queue/connection'

export const NUDGE_QUEUE_NAME = 'follow-up-nudges'

export type NudgeJobPayload = {
  userId?: string
  trigger: 'manual' | 'daily_cron'
}

let nudgeQueue: Queue<NudgeJobPayload> | null = null

export function getNudgeQueue() {
  if (!nudgeQueue) {
    nudgeQueue = new Queue<NudgeJobPayload>(NUDGE_QUEUE_NAME, {
      connection: queueConnection,
      defaultJobOptions,
    })
  }

  return nudgeQueue
}

export async function enqueueNudgeJob(payload: NudgeJobPayload) {
  const queue = getNudgeQueue()
  return queue.add(`nudge:${payload.userId || 'all'}:${Date.now()}`, payload)
}
