import { getRedisClient } from '@/lib/redis'

const DEFAULT_LOCK_TTL_SECONDS = 300

function getSyncLockKey(userId: string) {
  return `sync_lock:${userId}`
}

function redisDisabled() {
  return !process.env.REDIS_URL?.trim()
}

export async function acquireSyncLock(userId: string, ttlSeconds = DEFAULT_LOCK_TTL_SECONDS) {
  if (redisDisabled()) {
    return true
  }

  const redis = getRedisClient()
  const key = getSyncLockKey(userId)

  const result = await redis.set(key, '1', 'EX', ttlSeconds, 'NX')
  return result === 'OK'
}

export async function releaseSyncLock(userId: string) {
  if (redisDisabled()) {
    return
  }

  const redis = getRedisClient()
  try {
    await redis.del(getSyncLockKey(userId))
  } catch (err) {
    console.error('[syncLock] Failed to release lock for user:', userId, err instanceof Error ? err.message : err)
  }
}

export async function refreshSyncLock(userId: string, ttlSeconds = DEFAULT_LOCK_TTL_SECONDS) {
  if (redisDisabled()) {
    return true
  }

  const redis = getRedisClient()
  const key = getSyncLockKey(userId)
  const expiresIn = await redis.ttl(key)
  if (expiresIn <= 0) return false
  await redis.expire(key, ttlSeconds)
  return true
}
