import { NextResponse } from 'next/server'
import { getExtractionQueueStatusForUser } from '@/lib/queue/extractionQueueStatus'
import { createClient } from '@/lib/supabase/server'
import { isRedisConnected, getRedisClient } from '@/lib/redis'

export const dynamic = 'force-dynamic'

const EMPTY_QUEUE_STATUS = {
  counts: {
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
    delayed: 0,
  },
  isExtracting: false,
  failedSummaries: [] as Array<{
    jobId: string
    subject: string | null
    reason: string
    attemptsMade: number
  }>,
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  getRedisClient()

  if (!isRedisConnected()) {
    console.warn('[API] Redis not connected, returning empty queue status')
    return NextResponse.json(EMPTY_QUEUE_STATUS)
  }

  try {
    const status = await getExtractionQueueStatusForUser(user.id)
    return NextResponse.json(status)
  } catch (error) {
    console.error('[API] Queue status error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
