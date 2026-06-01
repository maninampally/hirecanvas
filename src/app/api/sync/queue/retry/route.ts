import { NextResponse } from 'next/server'
import { retryFailedExtractionsForUser } from '@/lib/queue/extractionQueueStatus'
import { createClient } from '@/lib/supabase/server'
import { getRedisClient, isRedisConnected } from '@/lib/redis'

export const dynamic = 'force-dynamic'

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  getRedisClient()

  if (!isRedisConnected()) {
    return NextResponse.json({ error: 'Redis unavailable' }, { status: 503 })
  }

  try {
    const result = await retryFailedExtractionsForUser(user.id)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[API] Retry failed extractions:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
