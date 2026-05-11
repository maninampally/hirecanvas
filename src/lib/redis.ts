import IORedis from 'ioredis'

export function getRedisConnectionOptions() {
  const redisUrl = process.env.REDIS_URL?.trim()
  if (!redisUrl) {
    throw new Error('REDIS_URL is required')
  }

  const parsed = new URL(redisUrl)

  return {
    host: parsed.hostname || 'valkey',
    port: parseInt(parsed.port || '6379', 10),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
    retryStrategy: (times: number) => {
      console.log(`[Redis] Reconnecting attempt ${times}...`)
      const delay = Math.min(times * 100, 2000)
      return delay
    },
    enableOfflineQueue: true,
    maxRetriesPerRequest: null,
    connectTimeout: 10000,
  }
}

const globalForRedis = global as unknown as { 
  redisSingleton: IORedis | undefined
  redisConnectionError: Error | undefined
}

export function getRedisClient(): IORedis {
  if (!globalForRedis.redisSingleton) {
    const options = getRedisConnectionOptions()
    console.log('[Redis] Initializing global singleton for host:', options.host)
    
    const client = new IORedis(options)
    
    client.on('error', (err) => {
      if (err.message.includes('ECONNREFUSED')) {
        console.warn('[Redis] Connection refused. Retrying...')
      } else {
        console.error('[Redis] Error:', err.message)
      }
      globalForRedis.redisConnectionError = err
    })
    
    client.on('connect', () => {
      console.log('[Redis] Connected successfully to', options.host)
      globalForRedis.redisConnectionError = undefined
    })

    client.on('ready', () => {
      globalForRedis.redisConnectionError = undefined
    })

    globalForRedis.redisSingleton = client
  }

  return globalForRedis.redisSingleton
}

export function isRedisConnected(): boolean {
  const client = globalForRedis.redisSingleton
  if (!client) return false
  const status = client.status
  return ['ready', 'connect'].includes(status)
}
