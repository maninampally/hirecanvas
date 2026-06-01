import { getExtractionQueue } from '@/lib/queue/extractionQueue'

async function main() {
  const q = getExtractionQueue()
  const states = ['failed', 'delayed', 'active', 'waiting', 'completed'] as const
  for (const state of states) {
    const jobs = await q.getJobs([state], 0, 200)
    console.log(`${state}: ${jobs.length} (global)`)
  }

  const failed = await q.getJobs(['failed'], 0, 200)
  console.log('\n=== FAILED JOB DETAILS ===\n')
  for (const j of failed) {
    const subject = j.data?.email?.subject ?? j.data?.emailId ?? '—'
    console.log(`Job ${j.id} | user ${j.data?.userId} | attempts ${j.attemptsMade}`)
    console.log(`  subject: ${subject}`)
    console.log(`  reason: ${j.failedReason ?? '(none)'}`)
    console.log('')
  }
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
