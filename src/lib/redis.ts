import IORedis from 'ioredis'

export function getRedisConnectionOptions() {
  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) {
    throw new Error('REDIS_URL is required')
  }

  const parsed = new URL(redisUrl)

  return {
    host: parsed.hostname || 'redis',
    port: parseInt(parsed.port || '6379', 10),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
    retryStrategy: (times: number) => {
      // Exponential backoff or simple fixed delay
      const delay = Math.min(times * 100, 2000)
      return delay
    },
    enableOfflineQueue: true,
    maxRetriesPerRequest: null,
    connectTimeout: 10000,
  }
}

let redisSingleton: IORedis | null = null
let redisConnectionError: Error | null = null

export function getRedisClient(): IORedis {
  if (!redisSingleton) {
    try {
      redisSingleton = new IORedis(getRedisConnectionOptions())
      
      redisSingleton.on('error', (err) => {
        console.warn('[Redis] Connection error:', err.message)
        redisConnectionError = err
      })
      
      redisSingleton.on('connect', () => {
        console.log('[Redis] Connected')
        redisConnectionError = null
      })
    } catch (error) {
      console.error('[Redis] Failed to initialize:', error)
      redisConnectionError = error instanceof Error ? error : new Error(String(error))
      // Fallback: return a dummy Redis client that won't crash but won't work
      redisSingleton = new IORedis({ host: 'localhost', port: 6379, retryStrategy: () => null })
    }
  }

  return redisSingleton
}

export function isRedisConnected(): boolean {
  return redisSingleton !== null && redisConnectionError === null
}
