import { ProviderError, type ProviderRequest, type ProviderResponse } from '@/lib/ai/gemini'

const DEFAULT_OLLAMA_MODEL = 'llama3.2'
const OLLAMA_API_URL = process.env.OLLAMA_API_URL || 'http://host.docker.internal:11434'

export async function runOllama(request: ProviderRequest): Promise<ProviderResponse> {
    const model = request.modelOverride || process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL
    console.log(`[Ollama] Attempting request to ${OLLAMA_API_URL} with model ${model}`)

    if (!request.systemPrompt) {
        throw new ProviderError('ollama', 'System prompt is required', { retryable: false })
    }

    if (!request.prompt) {
        throw new ProviderError('ollama', 'Prompt is required', { retryable: false })
    }

    let lastError: Error | null = null
    const maxRetries = 3

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const controller = new AbortController()
            const id = setTimeout(() => controller.abort(), 600000) // 10-minute timeout

            const response = await fetch(`${OLLAMA_API_URL}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    system: request.systemPrompt,
                    prompt: request.prompt,
                    stream: false,
                    options: {
                        temperature: request.temperature ?? 0.2,
                        num_predict: request.maxTokens ?? 1000,
                    },
                }),
                signal: controller.signal
            })
            clearTimeout(id)

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({})) as Record<string, unknown>
                throw new ProviderError('ollama', `Ollama error (${response.status}): ${typeof errorData.error === 'string' ? errorData.error : response.statusText}`, {
                    retryable: response.status >= 500,
                })
            }

            const payload = await response.json() as Record<string, unknown>
            return {
                text: typeof payload.response === 'string' ? payload.response : '',
                model: typeof payload.model === 'string' ? payload.model : model,
                usage: {
                    inputTokens: typeof payload.prompt_eval_count === 'number' ? payload.prompt_eval_count : 0,
                    outputTokens: typeof payload.eval_count === 'number' ? payload.eval_count : 0,
                    totalTokens: (typeof payload.prompt_eval_count === 'number' ? payload.prompt_eval_count : 0) + (typeof payload.eval_count === 'number' ? payload.eval_count : 0),
                },
            }
        } catch (error: unknown) {
            lastError = error instanceof Error ? error : new Error(String(error))
            if (error instanceof Error && error.name === 'AbortError') {
                console.error('[Ollama] Request timed out after 10 minutes')
                break // Don't retry timeouts
            }

            if (attempt < maxRetries) {
                const delay = attempt * 2000
                console.warn(`[Ollama] Attempt ${attempt} failed: ${lastError.message}. Retrying in ${delay}ms...`)
                await new Promise(resolve => setTimeout(resolve, delay))
                continue
            }
        }
    }

    if (lastError instanceof ProviderError) throw lastError
    console.error('Ollama request failed after retries:', lastError?.message)
    throw new ProviderError('ollama', `Ollama failed after ${maxRetries} attempts: ${lastError?.message}`, {
        retryable: true,
    })
}