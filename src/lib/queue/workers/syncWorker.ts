import { Worker } from 'bullmq'
import { queueConnection } from '@/lib/queue/connection'
import { SYNC_QUEUE_NAME, type SyncJobPayload } from '@/lib/queue/syncQueue'

export function createSyncWorker(
  processor: (payload: SyncJobPayload) => Promise<void>
) {
  return new Worker<SyncJobPayload>(
    SYNC_QUEUE_NAME,
    async (job) => {
      await processor(job.data)
    },
    {
      connection: queueConnection,
      concurrency: 2,
    }
  )
}
