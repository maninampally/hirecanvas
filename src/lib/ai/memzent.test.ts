import test from 'node:test'
import assert from 'node:assert/strict'
import { runMemzent } from '@/lib/ai/memzent'

test('runMemzent sends the configured key and returns text', async () => {
  const previousFetch = global.fetch
  const previousKey = process.env.MEMZENT_API_KEY
  process.env.MEMZENT_API_KEY = 'test-memzent-key'

  let requestBody: unknown = null
  let requestHeaders: Record<string, string> | null = null

  global.fetch = (async (_url: string | URL, init?: RequestInit) => {
    requestBody = init?.body ? JSON.parse(String(init.body)) : null
    requestHeaders = Object.fromEntries(
      Object.entries((init?.headers || {}) as Record<string, string>).map(([key, value]) => [key.toLowerCase(), value])
    )

    return {
      ok: true,
      status: 200,
      json: async () => ({ text: 'RBAC is role-based access control.' }),
    } as Response
  }) as typeof fetch

  try {
    const result = await runMemzent({ prompt: 'Explain role-based access control' })

    assert.equal(result.text, 'RBAC is role-based access control.')
    assert.equal(result.model, 'memzent-chat')
    assert.deepEqual(requestBody, {
      model: 'memzent-chat',
      skip_cache: false,
      messages: [{ role: 'user', content: 'Explain role-based access control' }],
    })
    assert.equal(requestHeaders?.['x-api-key'], 'test-memzent-key')
  } finally {
    global.fetch = previousFetch
    if (previousKey === undefined) {
      delete process.env.MEMZENT_API_KEY
    } else {
      process.env.MEMZENT_API_KEY = previousKey
    }
  }
})