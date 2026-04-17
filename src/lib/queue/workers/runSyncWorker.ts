import { createSyncWorker } from '@/lib/queue/workers/syncWorker'
import { processSyncJob } from '@/lib/sync/processSyncJob'

const worker = createSyncWorker(processSyncJob)

worker.on('completed', (job) => {
  console.log(`[sync-worker] completed job ${job.id}`)
})

worker.on('failed', (job, error) => {
  console.error(`[sync-worker] failed job ${job?.id}: ${error.message}`)
})

console.log('[sync-worker] running')
