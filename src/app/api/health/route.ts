import { createServiceClient } from '@/lib/supabase/service'
import { getRedisClient, isRedisConnected } from '@/lib/redis'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [dbResult, redisResult] = await Promise.allSettled([
    createServiceClient().from('app_users').select('id').limit(1),
    (async () => {
      if (!process.env.REDIS_URL?.trim()) return false
      const redis = getRedisClient()
      await redis.connect().catch(() => undefined)
      if (!isRedisConnected()) return false
      await redis.ping()
      return true
    })(),
  ])

  const db = dbResult.status === 'fulfilled' && !dbResult.value.error
  const redis = redisResult.status === 'fulfilled' && redisResult.value === true
  const healthy = db && redis

  return Response.json(
    { status: healthy ? 'ok' : 'degraded', timestamp: new Date().toISOString(), db, redis },
    { status: healthy ? 200 : 503 }
  )
}
