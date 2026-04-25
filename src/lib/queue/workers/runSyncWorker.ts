import { createSyncWorker } from '@/lib/queue/workers/syncWorker'
import { processSyncJob } from '@/lib/sync/processSyncJob'
import { logError, logInfo } from '@/lib/observability/logger'
import { captureSentryException, initSentry } from '@/lib/observability/sentry'

initSentry('worker-sync')

const worker = createSyncWorker(processSyncJob)

worker.on('completed', (job) => {
  logInfo('sync_worker_completed', { jobId: job.id })
})

worker.on('failed', (job, error) => {
  logError('sync_worker_failed', error, { jobId: job?.id })
  captureSentryException(error, { jobId: job?.id })
})

logInfo('sync_worker_running')
