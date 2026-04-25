import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRedisClient } from '@/lib/redis'
import { getSyncQueue } from '@/lib/queue/syncQueue'
import { getExtractionQueue } from '@/lib/queue/extractionQueue'

type QueueHealth = {
  ok: boolean
  waiting: number | null
  active: number | null
  delayed: number | null
  failed: number | null
  error?: string
}

type RedisHealth = {
  ok: boolean
  latencyMs: number | null
  error?: string
}

function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage)), ms)
    }),
  ])
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: tokens } = await supabase
    .from('oauth_tokens')
    .select('id,provider_email,is_revoked,expires_at,updated_at')
    .eq('user_id', user.id)
    .eq('provider', 'google_gmail')
    .order('updated_at', { ascending: false })
    .limit(5)

  const gmailConnections = (tokens || []).map((token) => ({
    id: token.id,
    email: token.provider_email || null,
    isRevoked: Boolean(token.is_revoked),
    expiresAt: token.expires_at || null,
    updatedAt: token.updated_at || null,
  }))

  const { data: latestSync } = await supabase
    .from('sync_status')
    .select('status,total_emails,processed_count,new_jobs_found,error_message,updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let redis: RedisHealth = { ok: false, latencyMs: null }
  try {
    const client = getRedisClient()
    const start = Date.now()
    await withTimeout(client.ping(), 1500, 'Redis ping timeout')
    redis = { ok: true, latencyMs: Date.now() - start }
  } catch (error) {
    redis = {
      ok: false,
      latencyMs: null,
      error: error instanceof Error ? error.message : 'Redis unavailable',
    }
  }

  async function getQueueHealth(kind: 'sync' | 'extraction'): Promise<QueueHealth> {
    if (!redis.ok) {
      return {
        ok: false,
        waiting: null,
        active: null,
        delayed: null,
        failed: null,
        error: 'Redis unavailable',
      }
    }

    try {
      const queue = kind === 'sync' ? getSyncQueue() : getExtractionQueue()
      const counts = await withTimeout(
        queue.getJobCounts('waiting', 'active', 'delayed', 'failed'),
        2000,
        `${kind} queue health timeout`
      )
      return {
        ok: true,
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        delayed: counts.delayed ?? 0,
        failed: counts.failed ?? 0,
      }
    } catch (error) {
      return {
        ok: false,
        waiting: null,
        active: null,
        delayed: null,
        failed: null,
        error: error instanceof Error ? error.message : `${kind} queue unavailable`,
      }
    }
  }

  const [syncQueue, extractionQueue] = await Promise.all([
    getQueueHealth('sync'),
    getQueueHealth('extraction'),
  ])

  return NextResponse.json({
    gmailConnections,
    latestSync: latestSync || null,
    redis,
    queues: {
      sync: syncQueue,
      extraction: extractionQueue,
    },
    checkedAt: new Date().toISOString(),
  })
}
