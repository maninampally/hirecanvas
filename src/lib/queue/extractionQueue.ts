import { Queue } from 'bullmq'
import { defaultJobOptions, queueConnection } from '@/lib/queue/connection'

export const EXTRACTION_QUEUE_NAME = 'ai-extraction'

export type ExtractionJobPayload = {
  userId: string
  emailId: string
  jobId?: string
  providerHint?: 'gemini' | 'claude' | 'openai'
}

let extractionQueue: Queue<ExtractionJobPayload> | null = null

export function getExtractionQueue() {
  if (!extractionQueue) {
    extractionQueue = new Queue<ExtractionJobPayload>(EXTRACTION_QUEUE_NAME, {
      connection: queueConnection,
      defaultJobOptions,
    })
  }

  return extractionQueue
}

export async function enqueueExtractionJob(payload: ExtractionJobPayload) {
  const queue = getExtractionQueue()
  return queue.add(`extract:${payload.userId}:${payload.emailId}`, payload)
}
