import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRedisClient } from '@/lib/redis'

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

  // TODO: Add stricter admin check if needed. For now, since HireCanvas is typically single-user/admin,
  // simply requiring authentication is fine.
  
  try {
    const redis = getRedisClient()
    await redis.connect().catch(() => {}) // Ignore if already connected

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
