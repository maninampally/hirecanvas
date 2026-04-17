import type { ConnectionOptions, JobsOptions } from 'bullmq'
import { getRedisConnectionOptions } from '@/lib/redis'

export const queueConnection: ConnectionOptions = getRedisConnectionOptions()

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
