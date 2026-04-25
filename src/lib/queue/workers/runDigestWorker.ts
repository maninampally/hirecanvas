import { getDigestQueue } from '@/lib/queue/digestQueue'
import { createDigestWorker } from '@/lib/queue/workers/digestWorker'
import { processDigestJob } from '@/lib/digest/processDigestJob'
import { logError, logInfo } from '@/lib/observability/logger'
import { captureSentryException, initSentry } from '@/lib/observability/sentry'

initSentry('worker-digest')

const worker = createDigestWorker(processDigestJob)

worker.on('completed', (job) => {
  logInfo('digest_worker_completed', { jobId: job.id })
})

worker.on('failed', (job, error) => {
  logError('digest_worker_failed', error, { jobId: job?.id })
  captureSentryException(error, { jobId: job?.id })
})

async function registerSchedule() {
  const queue = getDigestQueue()
  await queue.add(
    'daily-digest-scan',
    { trigger: 'daily_cron' },
    {
      jobId: 'daily-digest-scan',
      repeat: {
        pattern: '0 12 * * *',
      },
    }
  )
}

void registerSchedule().catch((error) => {
  logError('digest_schedule_registration_failed', error)
  captureSentryException(error)
})

logInfo('digest_worker_running')
