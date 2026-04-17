import { Worker } from 'bullmq'
import { queueConnection } from '@/lib/queue/connection'
import {
  EXTRACTION_QUEUE_NAME,
  type ExtractionJobPayload,
} from '@/lib/queue/extractionQueue'

export function createExtractionWorker(
  processor: (payload: ExtractionJobPayload) => Promise<void>
) {
  return new Worker<ExtractionJobPayload>(
    EXTRACTION_QUEUE_NAME,
    async (job) => {
      await processor(job.data)
    },
    {
      connection: queueConnection,
      concurrency: 4,
    }
  )
}
