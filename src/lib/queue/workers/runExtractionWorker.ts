import { createExtractionWorker } from '@/lib/queue/workers/extractionWorker'
import { processExtractionJob } from '@/lib/extraction/processExtractionJob'

const worker = createExtractionWorker(processExtractionJob)

worker.on('completed', (job) => {
  console.log(`[extraction-worker] completed job ${job.id}`)
})

worker.on('failed', (job, error) => {
  console.error(`[extraction-worker] failed job ${job?.id}: ${error.message}`)
})

console.log('[extraction-worker] running')
