import type IORedis from 'ioredis'
import { runClaude } from '@/lib/ai/claude'
import { ProviderError, type ProviderRequest } from '@/lib/ai/gemini'
import { runOpenAI } from '@/lib/ai/openai'
import { getRedisClient } from '@/lib/redis'
import { runGemini } from '@/lib/ai/gemini'

export type AIProvider = 'gemini' | 'claude' | 'openai'
export type RoutedProvider = AIProvider | 'regex_fallback'

const PROVIDER_CHAIN: AIProvider[] = ['gemini', 'claude', 'openai']
const COOLDOWN_MS = 6 * 60 * 60 * 1000

export type LLMRouterInput = {
  prompt: string
  systemPrompt?: string
  task?: 'job_extraction' | 'general'
  preferredProvider?: AIProvider
  strictPreferredProvider?: boolean
  temperature?: number
  maxTokens?: number
}

export type LLMRouterResult = {
  provider: RoutedProvider
  model: string
  text: string
  fallbackCount: number
  usage?: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
}

type ProviderHealth = {
  provider: AIProvider
  cooldownUntil: number
  lastError: string
  failures: number
  lastSuccessAt: number
}

let redisRef: IORedis | null | undefined

function getHealthKey(provider: AIProvider) {
  return `ai:provider:health:${provider}`
}

function getProviderOrder(preferredProvider?: AIProvider, strictPreferredProvider?: boolean) {
  if (preferredProvider && strictPreferredProvider) return [preferredProvider]
  if (!preferredProvider) return PROVIDER_CHAIN
  return [preferredProvider, ...PROVIDER_CHAIN.filter((provider) => provider !== preferredProvider)]
}

function parseEpoch(rawValue: string | undefined) {
  const value = Number(rawValue || '0')
  return Number.isFinite(value) ? value : 0
}

async function getRedisSafe() {
  if (redisRef !== undefined) return redisRef

  try {
    redisRef = getRedisClient()
    await redisRef.connect()
  } catch {
    redisRef = null
  }

  return redisRef
}

async function getProviderHealth(provider: AIProvider): Promise<ProviderHealth> {
  const redis = await getRedisSafe()
  if (!redis) {
    return {
      provider,
      cooldownUntil: 0,
      lastError: '',
      failures: 0,
      lastSuccessAt: 0,
    }
  }

  const health = await redis.hgetall(getHealthKey(provider))
  return {
    provider,
    cooldownUntil: parseEpoch(health.cooldownUntil),
    lastError: health.lastError || '',
    failures: parseEpoch(health.failures),
    lastSuccessAt: parseEpoch(health.lastSuccessAt),
  }
}

async function writeProviderHealth(provider: AIProvider, patch: Partial<ProviderHealth>) {
  const redis = await getRedisSafe()
  if (!redis) return

  const payload: Record<string, string> = {}
  if (patch.cooldownUntil !== undefined) payload.cooldownUntil = String(patch.cooldownUntil)
  if (patch.lastError !== undefined) payload.lastError = patch.lastError
  if (patch.failures !== undefined) payload.failures = String(patch.failures)
  if (patch.lastSuccessAt !== undefined) payload.lastSuccessAt = String(patch.lastSuccessAt)

  if (Object.keys(payload).length > 0) {
    await redis.hset(getHealthKey(provider), payload)
  }
}

function buildRegexFallback(input: LLMRouterInput, failedProviders: AIProvider[]): LLMRouterResult {
  const raw = input.prompt.toLowerCase()
  const status = raw.includes('offer')
    ? 'Offer'
    : raw.includes('interview')
    ? 'Interview'
    : raw.includes('assessment') || raw.includes('screen')
    ? 'Screening'
    : raw.includes('rejected') || raw.includes('unfortunately')
    ? 'Rejected'
    : raw.includes('applied') || raw.includes('application')
    ? 'Applied'
    : null

  const company = input.prompt.match(/at\s+([A-Za-z0-9&.\-\s]{2,})/i)?.[1]?.trim() || null

  const text =
    input.task === 'job_extraction'
      ? JSON.stringify(
          {
            provider: 'regex_fallback',
            company,
            inferredStatus: status,
            confidence: 0.2,
            failedProviders,
          },
          null,
          2
        )
      : 'Fallback response: provider models unavailable. Retry later.'

  return {
    provider: 'regex_fallback',
    model: 'regex-v1',
    text,
    fallbackCount: failedProviders.length,
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    },
  }
}

async function runProvider(provider: AIProvider, request: ProviderRequest) {
  if (provider === 'gemini') return runGemini(request)
  if (provider === 'claude') return runClaude(request)
  return runOpenAI(request)
}

export async function runWithLLMRouter(input: LLMRouterInput): Promise<LLMRouterResult> {
  const providerOrder = getProviderOrder(input.preferredProvider, input.strictPreferredProvider)
  const failedProviders: AIProvider[] = []

  for (const provider of providerOrder) {
    const health = await getProviderHealth(provider)
    if (health.cooldownUntil > Date.now()) {
      failedProviders.push(provider)
      continue
    }

    try {
      const response = await runProvider(provider, {
        prompt: input.prompt,
        systemPrompt: input.systemPrompt,
        temperature: input.temperature,
        maxTokens: input.maxTokens,
      })

      await writeProviderHealth(provider, {
        cooldownUntil: 0,
        lastError: '',
        failures: 0,
        lastSuccessAt: Date.now(),
      })

      return {
        provider,
        model: response.model,
        text: response.text,
        fallbackCount: failedProviders.length,
        usage: response.usage,
      }
    } catch (error) {
      failedProviders.push(provider)

      if (error instanceof ProviderError) {
        const failures = health.failures + 1
        await writeProviderHealth(provider, {
          failures,
          lastError: error.message,
          cooldownUntil: error.quotaError ? Date.now() + COOLDOWN_MS : health.cooldownUntil,
        })
      } else {
        await writeProviderHealth(provider, {
          failures: health.failures + 1,
          lastError: error instanceof Error ? error.message : 'unknown_error',
        })
      }
    }
  }

  return buildRegexFallback(input, failedProviders)
}
