import { getRedisClient } from '@/lib/redis'

type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetInSeconds: number
}

export async function enforceRateLimit(
  userId: string,
  featureKey: string,
  limit: number,
  windowInSeconds: number
): Promise<RateLimitResult> {
  const redis = getRedisClient()
  const key = `rate_limit:${featureKey}:${userId}`

  const count = await redis.incr(key)
  if (count === 1) {
    await redis.expire(key, windowInSeconds)
  }

  const ttl = await redis.ttl(key)
  const remaining = Math.max(0, limit - count)

  return {
    allowed: count <= limit,
    remaining,
    resetInSeconds: ttl > 0 ? ttl : windowInSeconds,
  }
}
