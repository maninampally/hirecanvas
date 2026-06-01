import { ProviderError, type ProviderRequest, type ProviderResponse } from '@/lib/ai/gemini'

const DEFAULT_MEMZENT_MODEL = 'memzent-chat'

function isQuotaError(statusCode: number | undefined, text: string) {
  const lower = text.toLowerCase()
  return (
    statusCode === 429 ||
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests')
  )
}

export async function runMemzent(request: ProviderRequest): Promise<ProviderResponse> {
  const apiKey = process.env.MEMZENT_API_KEY
  if (!apiKey) {
    throw new ProviderError('memzent', 'MEMZENT_API_KEY is not configured', {
      retryable: false,
    })
  }

  const model = request.modelOverride || process.env.MEMZENT_MODEL || DEFAULT_MEMZENT_MODEL
  const response = await fetch('https://api.memzent.ai/v1/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({
      model,
      skip_cache: false,
      messages: [
        ...(request.systemPrompt ? [{ role: 'system', content: request.systemPrompt }] : []),
        { role: 'user', content: request.prompt },
      ],
    }),
  })

  const payload = (await response.json()) as {
    text?: string
    response?: string
    message?: string
    choices?: Array<{ message?: { content?: string } }>
    usage?: {
      input_tokens?: number
      output_tokens?: number
      total_tokens?: number
    }
    error?: { message?: string } | string
  }

  if (!response.ok) {
    const message =
      typeof payload.error === 'string'
        ? payload.error
        : payload.error?.message || payload.message || 'Memzent request failed'
    throw new ProviderError('memzent', message, {
      statusCode: response.status,
      quotaError: isQuotaError(response.status, message),
    })
  }

  const text =
    payload.text?.trim() ||
    payload.response?.trim() ||
    payload.choices?.[0]?.message?.content?.trim() ||
    payload.message?.trim()

  if (!text) {
    throw new ProviderError('memzent', 'Memzent returned an empty response', {
      retryable: true,
    })
  }

  const inputTokens = payload.usage?.input_tokens || 0
  const outputTokens = payload.usage?.output_tokens || 0
  const totalTokens = payload.usage?.total_tokens || inputTokens + outputTokens

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