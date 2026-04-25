import type { ConnectionOptions, JobsOptions } from 'bullmq'
import { getRedisConnectionOptions } from '@/lib/redis'

let _queueConnection: ConnectionOptions | null = null
export function getQueueConnection(): ConnectionOptions {
  if (!_queueConnection) _queueConnection = getRedisConnectionOptions()
  return _queueConnection
}

// Lazy proxy — resolved on first property access so build-time imports don't throw
export const queueConnection: ConnectionOptions = new Proxy({} as ConnectionOptions, {
  get(_target, prop) {
    return getQueueConnection()[prop as keyof ConnectionOptions]
  },
})

export const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 60_000,
  },
  removeOnComplete: {
    age: 24 * 60 * 60,
    count: 500,
  },
  removeOnFail: {
    age: 7 * 24 * 60 * 60,
    count: 1000,
  },
}
