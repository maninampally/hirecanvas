import { ProviderError, type ProviderRequest, type ProviderResponse } from '@/lib/ai/gemini'

const DEFAULT_CLAUDE_MODEL = 'claude-3-5-sonnet-latest'

function isQuotaError(statusCode: number | undefined, text: string) {
  const lower = text.toLowerCase()
  return (
    statusCode === 429 ||
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests')
  )
}

export async function runClaude(request: ProviderRequest): Promise<ProviderResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new ProviderError('claude', 'ANTHROPIC_API_KEY is not configured', {
      retryable: false,
    })
  }

  const model = process.env.CLAUDE_MODEL || DEFAULT_CLAUDE_MODEL
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      system: request.systemPrompt,
      messages: [
        {
          role: 'user',
          content: request.prompt,
        },
      ],
      temperature: request.temperature ?? 0.2,
      max_tokens: request.maxTokens ?? 1000,
    }),
  })

  const payload = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>
    usage?: {
      input_tokens?: number
      output_tokens?: number
    }
    error?: { message?: string }
  }

  if (!response.ok) {
    const message = payload.error?.message || 'Claude request failed'
    throw new ProviderError('claude', message, {
      statusCode: response.status,
      quotaError: isQuotaError(response.status, message),
    })
  }

  const text = payload.content
    ?.filter((part) => part.type === 'text')
    .map((part) => part.text || '')
    .join('')
    .trim()

  if (!text) {
    throw new ProviderError('claude', 'Claude returned an empty response', {
      retryable: true,
    })
  }

  const inputTokens = payload.usage?.input_tokens || 0
  const outputTokens = payload.usage?.output_tokens || 0

  return {
    text,
    model,
    usage: {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    },
  }
}
