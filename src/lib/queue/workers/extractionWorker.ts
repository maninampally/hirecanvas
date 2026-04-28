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
      concurrency: 3,
      // 9 jobs/min with 3 concurrent workers × 3 API calls each = 9 calls/min per worker.
      // With 5 rotated keys, each key sees ~2 calls/min — well under per-key rate limits.
      limiter: {
        max: 9,
        duration: 60_000,
      },
    }
  )
}
