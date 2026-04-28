import { Queue } from 'bullmq'
import { defaultJobOptions, queueConnection } from '@/lib/queue/connection'

export const EXTRACTION_QUEUE_NAME = 'ai-extraction'

export type ExtractionEmailPayload = {
  gmailMessageId: string
  from: string
  subject: string
  snippet: string
  bodyText: string
  receivedAtIso: string
  contentHash: string | null
  emailDirection: 'outbound' | 'inbound' | 'unknown'
}

export type ExtractionJobPayload = {
  userId: string
  /** The email to classify → extract → verify → upsert */
  email?: ExtractionEmailPayload
  /** Back-compat: legacy callers that enqueue by existing job_emails row */
  emailId?: string
  jobId?: string
  providerHint?: 'gemini' | 'claude' | 'openai'
  /** Optional per-job override of the extraction config mode. */
  extractionMode?: 'balanced' | 'high_recall' | 'high_precision'
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
  const key = payload.email?.gmailMessageId || payload.emailId || `${Date.now()}`
  return queue.add(`extract:${payload.userId}:${key}`, payload)
}

export async function enqueueExtractionJobWithDelay(payload: ExtractionJobPayload, delayMs: number) {
  const queue = getExtractionQueue()
  const key = payload.email?.gmailMessageId || payload.emailId || `${Date.now()}`
  return queue.add(`extract:${payload.userId}:${key}:delayed`, payload, {
    delay: Math.max(1, delayMs),
  })
}
