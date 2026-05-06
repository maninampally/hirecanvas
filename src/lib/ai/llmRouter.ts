import type IORedis from 'ioredis'
import { runClaude } from '@/lib/ai/claude'
import { ProviderError, type ProviderRequest } from '@/lib/ai/gemini'
import { runOpenAI } from '@/lib/ai/openai'
import { getRedisClient } from '@/lib/redis'
import { runGemini } from '@/lib/ai/gemini'
import { runOllama } from '@/lib/ai/ollama'

export type AIProvider = 'gemini' | 'claude' | 'openai' | 'ollama'
export type RoutedProvider = AIProvider | 'regex_fallback'

const PROVIDER_CHAIN: AIProvider[] = ['gemini', 'openai', 'claude', 'ollama']
const COOLDOWN_MS = 25 * 1000

export type LLMRouterInput = {
  prompt: string
  systemPrompt?: string
  task?: 'job_extraction' | 'general'
  preferredProvider?: AIProvider
  strictPreferredProvider?: boolean
  temperature?: number
  maxTokens?: number
  /**
   * Force a specific model on whichever provider runs. Verifier stage
   * uses this so it can ask for `gpt-4o` instead of the extractor's
   * `gpt-4o-mini` when both stages end up on OpenAI.
   */
  modelOverride?: string
  /**
   * Per-provider model overrides — picked over `modelOverride` for the
   * matching provider. Lets the verifier set `gpt-4o` for openai while
   * leaving claude/gemini on their defaults.
   */
  modelOverridePerProvider?: Partial<Record<AIProvider, string>>
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

function isProviderConfigured(provider: AIProvider): boolean {
  if (provider === 'ollama') return true // Always accessible as a target
  if (provider === 'gemini') return !!process.env.GEMINI_API_KEY
  if (provider === 'openai') return !!process.env.OPENAI_API_KEY
  if (provider === 'claude') return !!process.env.ANTHROPIC_API_KEY
  return false
}

function getProviderOrder(preferredProvider?: AIProvider) {
  if (preferredProvider && isProviderConfigured(preferredProvider)) {
    return [preferredProvider, ...PROVIDER_CHAIN.filter((p) => p !== preferredProvider)]
  }
  
  return PROVIDER_CHAIN
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
  const providerOrder = getProviderOrder(input.preferredProvider)
  
  // SPECIAL RULE: For resume tasks, try Ollama first to avoid costs.
  // For other tasks, skip Ollama and only use paid providers (they fall back to regex if all fail).
  let chain: AIProvider[]
  if (input.task === 'resume_analysis' || input.task === 'resume_tailoring') {
    chain = providerOrder.filter(p => p === 'ollama')
  } else {
    chain = providerOrder.filter(p => p !== 'ollama')
  }

  const finalOrder = chain.length > 0 ? chain : providerOrder
  const failedProviders: AIProvider[] = []

  for (const provider of finalOrder) {
    const health = await getProviderHealth(provider)
    if (health.cooldownUntil > Date.now()) {
      failedProviders.push(provider)
      continue
    }

    try {
      const modelOverride = input.modelOverridePerProvider?.[provider] ?? input.modelOverride
      const response = await runProvider(provider, {
        prompt: input.prompt,
        systemPrompt: input.systemPrompt,
        temperature: input.temperature,
        maxTokens: input.maxTokens,
        modelOverride,
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
<<<<<<< Updated upstream

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
=======
      const failures = health.failures + 1
      const quotaError = error instanceof ProviderError && (error as ProviderError & { quotaError?: boolean }).quotaError
      await writeProviderHealth(provider, {
        failures,
        lastError: error instanceof Error ? error.message : 'unknown_error',
        cooldownUntil: quotaError ? Date.now() + COOLDOWN_MS : health.cooldownUntil,
      })
>>>>>>> Stashed changes
    }
  }

  return buildRegexFallback(input, failedProviders)
}
