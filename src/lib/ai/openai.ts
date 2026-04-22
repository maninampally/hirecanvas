import { ProviderError, type ProviderRequest, type ProviderResponse } from '@/lib/ai/gemini'

const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini'

function isQuotaError(statusCode: number | undefined, text: string) {
  const lower = text.toLowerCase()
  return (
    statusCode === 429 ||
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests')
  )
}

export async function runOpenAI(request: ProviderRequest): Promise<ProviderResponse> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new ProviderError('openai', 'OPENAI_API_KEY is not configured', {
      retryable: false,
    })
  }

  const model = process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        ...(request.systemPrompt
          ? [{ role: 'system', content: request.systemPrompt }]
          : []),
        { role: 'user', content: request.prompt },
      ],
      temperature: request.temperature ?? 0.2,
      max_tokens: request.maxTokens ?? 1000,
    }),
  })

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
    usage?: {
      prompt_tokens?: number
      completion_tokens?: number
      total_tokens?: number
    }
    error?: { message?: string }
  }

  if (!response.ok) {
    const message = payload.error?.message || 'OpenAI request failed'
    throw new ProviderError('openai', message, {
      statusCode: response.status,
      quotaError: isQuotaError(response.status, message),
    })
  }

  const text = payload.choices?.[0]?.message?.content?.trim()

  if (!text) {
    throw new ProviderError('openai', 'OpenAI returned an empty response', {
      retryable: true,
    })
  }

  const inputTokens = payload.usage?.prompt_tokens || 0
  const outputTokens = payload.usage?.completion_tokens || 0
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
