import { getDigestQueue } from '@/lib/queue/digestQueue'
import { createDigestWorker } from '@/lib/queue/workers/digestWorker'
import { processDigestJob } from '@/lib/digest/processDigestJob'

const worker = createDigestWorker(processDigestJob)

worker.on('completed', (job) => {
  console.log(`[digest-worker] completed job ${job.id}`)
})

worker.on('failed', (job, error) => {
  console.error(`[digest-worker] failed job ${job?.id}: ${error.message}`)
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

void registerSchedule()

console.log('[digest-worker] running')
