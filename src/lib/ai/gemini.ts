const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'

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
  provider: 'gemini' | 'claude' | 'openai'
  statusCode?: number
  retryable: boolean
  quotaError: boolean

  constructor(
    provider: 'gemini' | 'claude' | 'openai',
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

export async function runGemini(request: ProviderRequest): Promise<ProviderResponse> {
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
    const model = request.modelOverride || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
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
      }),
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
