const DEFAULT_GEMINI_MODEL = 'gemini-1.5-flash'

export type ProviderRequest = {
  prompt: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
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
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new ProviderError('gemini', 'GEMINI_API_KEY is not configured', {
      retryable: false,
    })
  }

  const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const combinedPrompt = request.systemPrompt
    ? `${request.systemPrompt}\n\n${request.prompt}`
    : request.prompt

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: combinedPrompt }],
        },
      ],
      generationConfig: {
        temperature: request.temperature ?? 0.2,
        maxOutputTokens: request.maxTokens ?? 1000,
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
    throw new ProviderError('gemini', message, {
      statusCode: response.status,
      quotaError: isQuotaError(response.status, message),
    })
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
