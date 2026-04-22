import { createClient } from '@/lib/supabase/server'
import { getRedisClient } from '@/lib/redis'
import { getSyncQueue } from '@/lib/queue/syncQueue'

export async function GET() {
  try {
    const supabase = await createClient()
    const redis = getRedisClient()
    const syncQueue = getSyncQueue()

    // Check database connection
    const { error: dbError } = await supabase
      .from('app_users')
      .select('count')
      .limit(1)
      .single()

    if (dbError && dbError.code !== 'PGRST116') {
      throw new Error('Database connection failed')
    }

    await redis.connect()
    const redisPong = await redis.ping()
    if (redisPong !== 'PONG') {
      throw new Error('Redis connection failed')
    }

    const waiting = await syncQueue.getWaitingCount()
    const active = await syncQueue.getActiveCount()
    const delayed = await syncQueue.getDelayedCount()
    const depth = waiting + active + delayed

    return Response.json(
      {
        status: 'ok',
        timestamp: new Date().toISOString(),
        db: true,
        redis: true,
        queue: {
          depth,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    return Response.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    )
  }
}
