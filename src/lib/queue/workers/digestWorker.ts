import { Worker } from 'bullmq'
import { getQueueConnection } from '@/lib/queue/connection'
import { DIGEST_QUEUE_NAME, type DigestJobPayload } from '@/lib/queue/digestQueue'

export function createDigestWorker(
  processor: (payload: DigestJobPayload) => Promise<void>
) {
  return new Worker<DigestJobPayload>(
    DIGEST_QUEUE_NAME,
    async (job) => {
      await processor(job.data)
    },
    {
      connection: getQueueConnection(),
      concurrency: 1,
    }
  )
}
