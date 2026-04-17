import { getRedisClient } from '@/lib/redis'

const DEFAULT_LOCK_TTL_SECONDS = 300

function getSyncLockKey(userId: string) {
  return `sync_lock:${userId}`
}

export async function acquireSyncLock(userId: string, ttlSeconds = DEFAULT_LOCK_TTL_SECONDS) {
  const redis = getRedisClient()
  const key = getSyncLockKey(userId)

  const result = await redis.set(key, '1', 'EX', ttlSeconds, 'NX')
  return result === 'OK'
}

export async function releaseSyncLock(userId: string) {
  const redis = getRedisClient()
  await redis.del(getSyncLockKey(userId))
}
