import IORedis from 'ioredis'

function getRedisUrl() {
  const url = process.env.REDIS_URL
  if (!url) {
    throw new Error('REDIS_URL is required')
  }
  return url
}

export function getRedisConnectionOptions() {
  const parsed = new URL(getRedisUrl())

  return {
    host: parsed.hostname,
    port: Number(parsed.port || '6379'),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
  }
}

let redisSingleton: IORedis | null = null

export function getRedisClient() {
  if (!redisSingleton) {
    redisSingleton = new IORedis(getRedisUrl(), {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: true,
    })
  }

  return redisSingleton
}
