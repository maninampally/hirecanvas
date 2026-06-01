import type { Job } from 'bullmq'
import { getExtractionQueue, type ExtractionJobPayload } from '@/lib/queue/extractionQueue'

export type ExtractionQueueCounts = {
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
}

export type FailedExtractionSummary = {
  jobId: string
  subject: string | null
  reason: string
  attemptsMade: number
}

export type ExtractionQueueStatus = {
  counts: ExtractionQueueCounts
  isExtracting: boolean
  failedSummaries: FailedExtractionSummary[]
}

function countForUser(jobs: Array<Job<ExtractionJobPayload>>, userId: string) {
  return jobs.filter((j) => j.data?.userId === userId).length
}

function summarizeFailedJob(job: Job<ExtractionJobPayload>): FailedExtractionSummary {
  const subject = job.data?.email?.subject ?? null
  const reason = (job.failedReason || 'Unknown error').replace(/\s+/g, ' ').trim()
  return {
    jobId: String(job.id),
    subject,
    reason: reason.length > 220 ? `${reason.slice(0, 217)}…` : reason,
    attemptsMade: job.attemptsMade,
  }
}

/** Queue snapshot for one user (failed jobs are global slice, then filtered). */
export async function getExtractionQueueStatusForUser(userId: string): Promise<ExtractionQueueStatus> {
  const queue = getExtractionQueue()

  const [waitingJobs, activeJobs, delayedJobs, failedJobs, completedJobs] = await Promise.all([
    queue.getJobs(['waiting'], 0, 300),
    queue.getJobs(['active'], 0, 80),
    queue.getJobs(['delayed'], 0, 300),
    queue.getJobs(['failed'], 0, 200),
    queue.getJobs(['completed'], 0, 1200),
  ])

  const userFailedJobs = failedJobs.filter((j) => j.data?.userId === userId)
  const failedSummaries = await Promise.all(
    userFailedJobs.map(async (job) => {
      const state = await job.getState()
      if (state !== 'failed') return null
      return summarizeFailedJob(job)
    })
  )

  const validSummaries = failedSummaries.filter((s): s is FailedExtractionSummary => s !== null)

  const counts: ExtractionQueueCounts = {
    waiting: countForUser(waitingJobs, userId),
    active: countForUser(activeJobs, userId),
    completed: countForUser(completedJobs, userId),
    failed: validSummaries.length,
    delayed: countForUser(delayedJobs, userId),
  }

  return {
    counts,
    isExtracting: counts.waiting > 0 || counts.active > 0 || counts.delayed > 0,
    failedSummaries: validSummaries,
  }
}

export async function retryFailedExtractionsForUser(userId: string) {
  const queue = getExtractionQueue()
  const failedJobs = await queue.getJobs(['failed'], 0, 200)
  const userFailed = failedJobs.filter((j) => j.data?.userId === userId)

  let retried = 0
  for (const job of userFailed) {
    const state = await job.getState()
    if (state !== 'failed') continue
    await job.retry()
    retried += 1
  }
  return { retried }
}
