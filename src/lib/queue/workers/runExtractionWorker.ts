import { createExtractionWorker } from '@/lib/queue/workers/extractionWorker'
import { processExtractionJob } from '@/lib/extraction/processExtractionJob'
import { logError, logInfo } from '@/lib/observability/logger'
import { captureSentryException, initSentry } from '@/lib/observability/sentry'

initSentry('worker-extraction')

const worker = createExtractionWorker(processExtractionJob)

worker.on('completed', (job) => {
  logInfo('extraction_worker_completed', { jobId: job.id })
})

worker.on('failed', (job, error) => {
  logError('extraction_worker_failed', error, { jobId: job?.id })
  captureSentryException(error, { jobId: job?.id })
})

logInfo('extraction_worker_running')
