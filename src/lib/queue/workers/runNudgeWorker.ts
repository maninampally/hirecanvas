import { getNudgeQueue } from '@/lib/queue/nudgeQueue'
import { createNudgeWorker } from '@/lib/queue/workers/nudgeWorker'
import { processNudgeJob } from '@/lib/nudges/processNudgeJob'

const worker = createNudgeWorker(processNudgeJob)

worker.on('completed', (job) => {
  console.log(`[nudge-worker] completed job ${job.id}`)
})

worker.on('failed', (job, error) => {
  console.error(`[nudge-worker] failed job ${job?.id}: ${error.message}`)
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

void registerSchedule()

console.log('[nudge-worker] running')
