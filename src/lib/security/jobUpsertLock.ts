import { getRedisClient } from '@/lib/redis'

const KEY_PREFIX = 'job_upsert:'
const TTL_SEC = parseInt(process.env.JOB_UPSERT_LOCK_TTL_SEC || '120', 10)
const SPIN_MS = parseInt(process.env.JOB_UPSERT_LOCK_SPIN_MS || '200', 10)
const MAX_SPINS = parseInt(process.env.JOB_UPSERT_LOCK_MAX_SPINS || '300', 10)

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
    } catch (err) {
      console.warn('[jobUpsertLock] Redis error, running without lock:', err instanceof Error ? err.message : err)
      return fn()
    }
    // log occasional spin progress for long waits
    if (spin > 0 && spin % Math.max(1, Math.floor(1000 / SPIN_MS)) === 0) {
      console.warn(`[jobUpsertLock] waiting for lock ${key} spin=${spin}/${MAX_SPINS}`)
    }
    await new Promise((r) => setTimeout(r, SPIN_MS))
  }

  throw new Error('job_upsert_lock_timeout')
}
