import test from 'node:test'
import assert from 'node:assert/strict'
import { runWithLLMRouter } from '@/lib/ai/llmRouter'

function restoreEnvVar(key: 'GEMINI_API_KEY' | 'ANTHROPIC_API_KEY' | 'OPENAI_API_KEY', value: string | undefined) {
  if (value === undefined) {
    delete process.env[key]
  } else {
    process.env[key] = value
  }
}

test('llm router returns regex fallback when no provider keys configured', async () => {
  const previous = {
    gemini: process.env.GEMINI_API_KEY,
    claude: process.env.ANTHROPIC_API_KEY,
    openai: process.env.OPENAI_API_KEY,
  }

  delete process.env.GEMINI_API_KEY
  delete process.env.ANTHROPIC_API_KEY
  delete process.env.OPENAI_API_KEY

  try {
    const result = await runWithLLMRouter({
      task: 'job_extraction',
      prompt: 'Interview scheduled at Stripe',
    })

    assert.equal(result.provider, 'regex_fallback')
    assert.equal(result.fallbackCount, 3)
  } finally {
    restoreEnvVar('GEMINI_API_KEY', previous.gemini)
    restoreEnvVar('ANTHROPIC_API_KEY', previous.claude)
    restoreEnvVar('OPENAI_API_KEY', previous.openai)
  }
})

test('llm router fails over from gemini to claude', async () => {
  const previousFetch = global.fetch
  const previous = {
    gemini: process.env.GEMINI_API_KEY,
    claude: process.env.ANTHROPIC_API_KEY,
    openai: process.env.OPENAI_API_KEY,
  }

  process.env.GEMINI_API_KEY = 'test-gemini'
  process.env.ANTHROPIC_API_KEY = 'test-claude'
  delete process.env.OPENAI_API_KEY

  let geminiCalled = 0
  let claudeCalled = 0

  global.fetch = (async (url: string | URL) => {
    const stringUrl = String(url)

    if (stringUrl.includes('generativelanguage.googleapis.com')) {
      geminiCalled += 1
      return {
        ok: false,
        status: 429,
        json: async () => ({ error: { message: 'quota exceeded' } }),
      } as Response
    }

    if (stringUrl.includes('api.anthropic.com')) {
      claudeCalled += 1
      return {
        ok: true,
        status: 200,
        json: async () => ({
          content: [{ type: 'text', text: '{"status":"Interview","confidence":0.9}' }],
        }),
      } as Response
    }

    return {
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'unexpected request' } }),
    } as Response
  }) as typeof fetch

  try {
    const result = await runWithLLMRouter({
      task: 'job_extraction',
      prompt: 'Interview invitation from company',
    })

    assert.equal(result.provider, 'claude')
    assert.equal(result.fallbackCount, 2) // gemini + openai (no key = immediate throw) both fail before claude
    assert.equal(geminiCalled >= 1, true)
    assert.equal(claudeCalled >= 1, true)
  } finally {
    global.fetch = previousFetch
    restoreEnvVar('GEMINI_API_KEY', previous.gemini)
    restoreEnvVar('ANTHROPIC_API_KEY', previous.claude)
    restoreEnvVar('OPENAI_API_KEY', previous.openai)
  }
})
