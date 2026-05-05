import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getRedisClient, isRedisConnected } from '@/lib/redis'

export const dynamic = 'force-dynamic'

const PROVIDERS = ['gemini', 'openai', 'claude']

function parseEpoch(rawValue: string | undefined) {
  const value = Number(rawValue || '0')
  return Number.isFinite(value) ? value : 0
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Restrict to admin tier only
  const service = createServiceClient()
  const { data: appUser } = await service
    .from('app_users')
    .select('tier')
    .eq('id', user.id)
    .maybeSingle<{ tier: string }>()

  if (appUser?.tier !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // If Redis is not connected, return empty provider health data for dev environment
    if (!isRedisConnected()) {
      console.warn('[API] Redis not connected, returning default provider status')
      const healthData = PROVIDERS.map((provider) => ({
        provider,
        status: 'healthy',
        cooldownUntil: 0,
        lastError: null,
        failures: 0,
        lastSuccessAt: 0,
      }))
      return NextResponse.json({ providers: healthData })
    }

    const redis = getRedisClient()
    await redis.connect().catch(() => {})

    const healthData = await Promise.all(
      PROVIDERS.map(async (provider) => {
        const health = await redis.hgetall(`ai:provider:health:${provider}`)
        const cooldownUntil = parseEpoch(health.cooldownUntil)
        const isCooldown = cooldownUntil > Date.now()

        let status = 'healthy'
        if (isCooldown) {
          status = 'cooldown'
        } else if (parseEpoch(health.failures) > 3) {
          status = 'degraded'
        }

        return {
          provider,
          status,
          cooldownUntil,
          lastError: health.lastError || null,
          failures: parseEpoch(health.failures),
          lastSuccessAt: parseEpoch(health.lastSuccessAt),
        }
      })
    )

    return NextResponse.json({ providers: healthData })
  } catch (error) {
    console.error('[API] Admin providers error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
