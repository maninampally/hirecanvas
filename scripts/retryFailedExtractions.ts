/**
 * Retry all failed extraction jobs (optionally for one user id).
 * Usage: npm run queue:retry-failed
 *        npm run queue:retry-failed -- <user-uuid>
 */
import {
  getExtractionQueueStatusForUser,
  retryFailedExtractionsForUser,
} from '@/lib/queue/extractionQueueStatus'
import { getExtractionQueue } from '@/lib/queue/extractionQueue'

async function main() {
  const userId = process.argv[2]?.trim()
  const queue = getExtractionQueue()
  const failed = await queue.getJobs(['failed'], 0, 200)
  console.log(`Global failed jobs: ${failed.length}`)

  if (userId) {
    const before = await getExtractionQueueStatusForUser(userId)
    console.log(`User ${userId} failed before retry: ${before.counts.failed}`)
    const { retried } = await retryFailedExtractionsForUser(userId)
    const after = await getExtractionQueueStatusForUser(userId)
    console.log(`Retried: ${retried}, failed after: ${after.counts.failed}`)
  } else {
    let retried = 0
    for (const job of failed) {
      const state = await job.getState()
      if (state !== 'failed') continue
      await job.retry()
      retried += 1
      console.log(`Retried job ${job.id} (${job.data?.email?.subject ?? 'no subject'})`)
    }
    console.log(`Total retried: ${retried}`)
  }
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
