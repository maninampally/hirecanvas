import { getNudgeQueue } from '@/lib/queue/nudgeQueue'
import { createNudgeWorker } from '@/lib/queue/workers/nudgeWorker'
import { processNudgeJob } from '@/lib/nudges/processNudgeJob'
import { logError, logInfo } from '@/lib/observability/logger'
import { captureSentryException, initSentry } from '@/lib/observability/sentry'

initSentry('worker-nudge')

const worker = createNudgeWorker(processNudgeJob)

worker.on('completed', (job) => {
  logInfo('nudge_worker_completed', { jobId: job.id })
})

worker.on('failed', (job, error) => {
  logError('nudge_worker_failed', error, { jobId: job?.id })
  captureSentryException(error, { jobId: job?.id })
})

async function registerSchedule() {
  const queue = getNudgeQueue()
  await queue.add(
    'daily-nudge-scan',
    { trigger: 'daily_cron' },
    {
      jobId: 'daily-nudge-scan',
      repeat: {
        pattern: '0 13 * * *',
      },
    }
  )
}

void registerSchedule().catch((error) => {
  logError('nudge_schedule_registration_failed', error)
  captureSentryException(error)
})

logInfo('nudge_worker_running')
