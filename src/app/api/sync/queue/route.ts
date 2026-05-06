import { NextResponse } from 'next/server'
import { getExtractionQueue } from '@/lib/queue/extractionQueue'
import { createClient } from '@/lib/supabase/server'
import { isRedisConnected, getRedisClient } from '@/lib/redis'

export const dynamic = 'force-dynamic'

function countForUser<T extends { data?: { userId?: string } }>(jobs: T[], userId: string) {
  return jobs.filter((j) => j.data?.userId === userId).length
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Ensure Redis client is initialized
  getRedisClient()

  // If Redis is not connected, return empty queue status for dev environment
  if (!isRedisConnected()) {
    console.warn('[API] Redis not connected, returning empty queue status')
    return NextResponse.json({
      counts: {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      },
      isExtracting: false,
    })
  }

  try {
    const queue = getExtractionQueue()

    const [waitingJobs, activeJobs, delayedJobs, failedJobs, completedJobs] = await Promise.all([
      queue.getJobs(['waiting'], 0, 300),
      queue.getJobs(['active'], 0, 80),
      queue.getJobs(['delayed'], 0, 300),
      queue.getJobs(['failed'], 0, 150),
      // Recent completed jobs only (global slice); filter by user for a sensible progress hint.
      queue.getJobs(['completed'], 0, 1200),
    ])

    const counts = {
      waiting: countForUser(waitingJobs, user.id),
      active: countForUser(activeJobs, user.id),
      completed: countForUser(completedJobs, user.id),
      failed: countForUser(failedJobs, user.id),
      delayed: countForUser(delayedJobs, user.id),
    }

    return NextResponse.json({
      counts,
      isExtracting: counts.waiting > 0 || counts.active > 0 || counts.delayed > 0,
    })
  } catch (error) {
    console.error('[API] Queue status error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
