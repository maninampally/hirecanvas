import { Worker } from 'bullmq'
import { getQueueConnection } from '@/lib/queue/connection'
import { NUDGE_QUEUE_NAME, type NudgeJobPayload } from '@/lib/queue/nudgeQueue'

export function createNudgeWorker(
  processor: (payload: NudgeJobPayload) => Promise<void>
) {
  return new Worker<NudgeJobPayload>(
    NUDGE_QUEUE_NAME,
    async (job) => {
      await processor(job.data)
    },
    {
      connection: getQueueConnection(),
      concurrency: 2,
    }
  )
}
