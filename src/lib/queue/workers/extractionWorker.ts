import { Worker } from 'bullmq'
import { DailyAIBudgetExceededError } from '@/lib/ai/costGuard'
import { enqueueExtractionJobWithDelay } from '@/lib/queue/extractionQueue'
import { getQueueConnection } from '@/lib/queue/connection'
import { createServiceClient } from '@/lib/supabase/service'
import {
  EXTRACTION_QUEUE_NAME,
  type ExtractionJobPayload,
} from '@/lib/queue/extractionQueue'

// 3-stage pipeline does up to 3 LLM calls (~5-15s each) plus DB writes.
// 90s gives plenty of headroom; anything beyond is a hung provider that
// should fail fast so BullMQ can retry the job rather than poison the queue.
const JOB_TIMEOUT_MS = 90_000

async function markDailyBudgetReached(userId: string, error: DailyAIBudgetExceededError) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('sync_status')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>()

  if (!data?.id) return

  await supabase
    .from('sync_status')
    .update({
      error_message: `Daily AI budget reached (${error.spentCents}/${error.dailyCapCents} cents used). Remaining extraction jobs will retry automatically in 12 hours.`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', data.id)
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label}_timeout_${ms}ms`)), ms)
    ),
  ])
}

export function createExtractionWorker(
  processor: (payload: ExtractionJobPayload) => Promise<unknown>
) {
  return new Worker<ExtractionJobPayload>(
    EXTRACTION_QUEUE_NAME,
    async (job) => {
      try {
        await withTimeout(processor(job.data), JOB_TIMEOUT_MS, 'extraction_job')
      } catch (error) {
        if (error instanceof DailyAIBudgetExceededError) {
          await markDailyBudgetReached(job.data.userId, error)
          await enqueueExtractionJobWithDelay(job.data, 12 * 60 * 60 * 1000)
          return
        }
        throw error
      }
    },
    {
      connection: getQueueConnection(),
      concurrency: 8,
      // Paid keys: Gemini 1000 RPM, OpenAI 500 RPM, Haiku 50 RPM.
      // 8 concurrency × 3 LLM calls × 20/min = ~160 calls/min — well within limits.
      limiter: {
        max: 20,
        duration: 60_000,
      },
    }
  )
}
