import { Worker } from 'bullmq'
import { DailyAIBudgetExceededError } from '@/lib/ai/costGuard'
import { enqueueExtractionJobWithDelay } from '@/lib/queue/extractionQueue'
import { queueConnection } from '@/lib/queue/connection'
import {
  EXTRACTION_QUEUE_NAME,
  type ExtractionJobPayload,
} from '@/lib/queue/extractionQueue'

export function createExtractionWorker(
  processor: (payload: ExtractionJobPayload) => Promise<unknown>
) {
  return new Worker<ExtractionJobPayload>(
    EXTRACTION_QUEUE_NAME,
    async (job) => {
      try {
        await processor(job.data)
      } catch (error) {
        if (error instanceof DailyAIBudgetExceededError) {
          await enqueueExtractionJobWithDelay(job.data, 12 * 60 * 60 * 1000)
          return
        }
        throw error
      }
    },
    {
      connection: queueConnection,
      concurrency: 1,
      // 3 jobs/min × 3 API calls each = 9 calls/min — safely under each key's 20/min limit.
      // BullMQ releases all 3 at the start of each minute, so the burst stays small.
      limiter: {
        max: 3,
        duration: 60_000,
      },
    }
  )
}
