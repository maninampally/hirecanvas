import { getRedisClient } from '@/lib/redis'

type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetInSeconds: number
}

// Atomic Lua script: INCR + conditional EXPIRE in a single round-trip.
// Prevents the TOCTOU race where the process crashes between INCR and EXPIRE,
// leaving a key that never expires and permanently blocks the user.
const RATE_LIMIT_LUA = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])

local count = redis.call('INCR', key)
if count == 1 then
  redis.call('EXPIRE', key, window)
end

local ttl = redis.call('TTL', key)
return {count, ttl}
`

export async function enforceRateLimit(
  userId: string,
  featureKey: string,
  limit: number,
  windowInSeconds: number
): Promise<RateLimitResult> {
  if (!process.env.REDIS_URL?.trim()) {
    console.warn('[rateLimit] REDIS_URL not set — rate limiting disabled')
    return { allowed: true, remaining: limit, resetInSeconds: windowInSeconds }
  }

  const redis = getRedisClient()
  const key = `rate_limit:${featureKey}:${userId}`

  try {
    const result = await redis.eval(
      RATE_LIMIT_LUA,
      1,
      key,
      String(limit),
      String(windowInSeconds)
    ) as [number, number]

    const count = result[0]
    const ttl = result[1]
    const remaining = Math.max(0, limit - count)

    return {
      allowed: count <= limit,
      remaining,
      resetInSeconds: ttl > 0 ? ttl : windowInSeconds,
    }
  } catch (err) {
    console.error('[rateLimit] Redis error — failing open:', err instanceof Error ? err.message : err)
    return { allowed: true, remaining: limit, resetInSeconds: windowInSeconds }
  }
}
