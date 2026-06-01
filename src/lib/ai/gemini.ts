const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'
const DEFAULT_BATCH_WINDOW_MS = 50
const DEFAULT_BATCH_MAX = 20

export type ProviderRequest = {
  prompt: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  /**
   * Per-call model override. Lets the caller force a specific model
   * (e.g. `gpt-4o` for the verifier stage when the extractor ran on
   * `gpt-4o-mini`) so cross-model verification still happens even when
   * the preferred provider family has no credits.
   */
  modelOverride?: string
}

export type ProviderResponse = {
  text: string
  model: string
  usage?: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
}

export class ProviderError extends Error {
  provider: 'gemini' | 'claude' | 'openai' | 'ollama' | 'memzent'
  statusCode?: number
  retryable: boolean
  quotaError: boolean

  constructor(
    provider: 'gemini' | 'claude' | 'openai' | 'ollama' | 'memzent',
    message: string,
    opts?: { statusCode?: number; retryable?: boolean; quotaError?: boolean }
  ) {
    super(message)
    this.name = 'ProviderError'
    this.provider = provider
    this.statusCode = opts?.statusCode
    this.retryable = opts?.retryable ?? true
    this.quotaError = opts?.quotaError ?? false
  }
}

function isQuotaError(statusCode: number | undefined, text: string) {
  const lower = text.toLowerCase()
  return (
    statusCode === 429 ||
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests')
  )
}

function shouldUseGeminiBatch() {
  return process.env.GEMINI_BATCH_ENABLED === 'true'
}

function resolveGeminiModel(request: ProviderRequest) {
  return request.modelOverride || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL
}

function buildGeminiRequestBody(request: ProviderRequest) {
  return {
    ...(request.systemPrompt && {
      system_instruction: {
        parts: [{ text: request.systemPrompt }],
      },
    }),
    contents: [
      {
        role: 'user',
        parts: [{ text: request.prompt }],
      },
    ],
    generationConfig: {
      temperature: request.temperature ?? 0,
      maxOutputTokens: request.maxTokens ?? 1000,
      // Disable thinking for gemini-2.5-flash — it uses ~1000 thinking tokens
      // that eat into the output budget, causing JSON truncation
      thinkingConfig: { thinkingBudget: 0 },
    },
  }
}

type BatchItem = {
  request: ProviderRequest
  resolve: (value: ProviderResponse) => void
  reject: (error: Error) => void
}

type BatchState = {
  items: BatchItem[]
  timer: NodeJS.Timeout | null
  flushing: boolean
}

const batchStates = new Map<string, BatchState>()

function getBatchState(model: string) {
  const existing = batchStates.get(model)
  if (existing) return existing
  const state: BatchState = { items: [], timer: null, flushing: false }
  batchStates.set(model, state)
  return state
}

async function runGeminiBatchRequest(model: string, items: BatchItem[]): Promise<ProviderResponse[]> {
  const keys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
    process.env.GEMINI_API_KEY_5,
  ].filter(Boolean) as string[]

  if (keys.length === 0) {
    throw new ProviderError('gemini', 'GEMINI_API_KEY is not configured', {
      retryable: false,
    })
  }

  let lastError: ProviderError | null = null

  for (const apiKey of keys) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:batchGenerateContent?key=${apiKey}`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: items.map((item) => buildGeminiRequestBody(item.request)),
      }),
    })

    const payload = (await response.json()) as {
      responses?: Array<{
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
        usageMetadata?: {
          promptTokenCount?: number
          candidatesTokenCount?: number
          totalTokenCount?: number
        }
        error?: { message?: string }
      }>
      error?: { message?: string }
    }

    if (!response.ok) {
      const message = payload.error?.message || 'Gemini batch request failed'
      lastError = new ProviderError('gemini', message, {
        statusCode: response.status,
        quotaError: isQuotaError(response.status, message),
      })
      if (isQuotaError(response.status, message) && keys.indexOf(apiKey) < keys.length - 1) {
        continue
      }
      throw lastError
    }

    const responses = payload.responses || []
    if (responses.length !== items.length) {
      throw new ProviderError(
        'gemini',
        `Gemini batch response mismatch (expected ${items.length}, got ${responses.length})`,
        { retryable: true }
      )
    }
    return responses.map((entry, index) => {
      if (entry?.error?.message) {
        throw new ProviderError('gemini', entry.error.message)
      }

      const text = entry?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('')?.trim()
      if (!text) {
        throw new ProviderError('gemini', `Gemini batch response ${index} was empty`, {
          retryable: true,
        })
      }

      const inputTokens = entry.usageMetadata?.promptTokenCount || 0
      const outputTokens = entry.usageMetadata?.candidatesTokenCount || 0
      const totalTokens = entry.usageMetadata?.totalTokenCount || inputTokens + outputTokens

      return {
        text,
        model,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens,
        },
      }
    })
  }

  throw lastError || new ProviderError('gemini', 'All Gemini API keys exhausted', { quotaError: true })
}

async function flushBatch(model: string) {
  const state = getBatchState(model)
  if (state.flushing || state.items.length === 0) return

  const batchMax = Number(process.env.GEMINI_BATCH_MAX || DEFAULT_BATCH_MAX)
  const items = state.items.splice(0, batchMax)
  state.flushing = true

  try {
    const responses = await runGeminiBatchRequest(model, items)
    responses.forEach((response, index) => {
      items[index]?.resolve(response)
    })
  } catch (error) {
    items.forEach((item) => item.reject(error as Error))
  } finally {
    state.flushing = false
    if (state.items.length > 0) {
      setTimeout(() => void flushBatch(model), 0)
    }
  }
}

function enqueueGeminiBatch(request: ProviderRequest): Promise<ProviderResponse> {
  const model = resolveGeminiModel(request)
  const state = getBatchState(model)
  const batchWindow = Number(process.env.GEMINI_BATCH_WINDOW_MS || DEFAULT_BATCH_WINDOW_MS)

  return new Promise((resolve, reject) => {
    state.items.push({ request, resolve, reject })

    if (state.items.length >= Number(process.env.GEMINI_BATCH_MAX || DEFAULT_BATCH_MAX)) {
      if (state.timer) {
        clearTimeout(state.timer)
        state.timer = null
      }
      void flushBatch(model)
      return
    }

    if (!state.timer) {
      state.timer = setTimeout(() => {
        state.timer = null
        void flushBatch(model)
      }, batchWindow)
    }
  })
}

export async function runGemini(request: ProviderRequest): Promise<ProviderResponse> {
  if (shouldUseGeminiBatch()) {
    return enqueueGeminiBatch(request)
  }

  // Support key rotation: try each key on quota errors
  const keys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
    process.env.GEMINI_API_KEY_5,
  ].filter(Boolean) as string[]
  if (keys.length === 0) {
    throw new ProviderError('gemini', 'GEMINI_API_KEY is not configured', {
      retryable: false,
    })
  }

  let lastError: ProviderError | null = null

  for (const apiKey of keys) {
    const model = resolveGeminiModel(request)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildGeminiRequestBody(request)),
    })

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      usageMetadata?: {
        promptTokenCount?: number
        candidatesTokenCount?: number
        totalTokenCount?: number
      }
      error?: { message?: string }
    }

    if (!response.ok) {
      const message = payload.error?.message || 'Gemini request failed'
      lastError = new ProviderError('gemini', message, {
        statusCode: response.status,
        quotaError: isQuotaError(response.status, message),
      })
      // If quota error and we have more keys, try the next one
      if (isQuotaError(response.status, message) && keys.indexOf(apiKey) < keys.length - 1) {
        continue
      }
      throw lastError
    }

    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('')?.trim()

    if (!text) {
      throw new ProviderError('gemini', 'Gemini returned an empty response', {
        retryable: true,
      })
    }

    const inputTokens = payload.usageMetadata?.promptTokenCount || 0
    const outputTokens = payload.usageMetadata?.candidatesTokenCount || 0
    const totalTokens = payload.usageMetadata?.totalTokenCount || inputTokens + outputTokens

    return {
      text,
      model,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens,
      },
    }
  }

  // Should never reach here, but just in case
  throw lastError || new ProviderError('gemini', 'All Gemini API keys exhausted', { quotaError: true })
}
