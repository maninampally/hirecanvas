import { getRedisClient } from '@/lib/redis'

const KEY_PREFIX = 'job_upsert:'
const TTL_SEC = 120
const SPIN_MS = 200
const MAX_SPINS = 75

/**
 * Serializes `upsertJobFromExtraction` per user so two concurrent extractions
 * cannot both miss the same job row and insert duplicates (AUD-02).
 * No-op when `REDIS_URL` is unset (e.g. some dev setups).
 */
export async function withJobUpsertLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  if (!process.env.REDIS_URL?.trim()) {
    return fn()
  }

  const redis = getRedisClient()
  const key = `${KEY_PREFIX}${userId}`

  for (let spin = 0; spin < MAX_SPINS; spin++) {
    try {
      const ok = await redis.set(key, '1', 'EX', TTL_SEC, 'NX')
      if (ok === 'OK') {
        try {
          return await fn()
        } finally {
          await redis.del(key).catch(() => {})
        }
      }
    } catch {
      return fn()
    }
    await new Promise((r) => setTimeout(r, SPIN_MS))
  }

  throw new Error('job_upsert_lock_timeout')
}
