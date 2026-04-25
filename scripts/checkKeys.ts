/**
 * Quick provider health check.
 * Usage: npm run check:keys
 *
 * Sends the smallest possible request to each configured provider and prints
 * one line per key with the HTTP status + reason.
 */

type CheckResult = {
  name: string
  ok: boolean
  status: number | 'network_error' | 'not_configured'
  detail: string
}

async function checkGemini(key: string | undefined, label: string): Promise<CheckResult> {
  if (!key) return { name: label, ok: false, status: 'not_configured', detail: 'missing' }
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
        generationConfig: { maxOutputTokens: 5, temperature: 0 },
      }),
    })
    const body = (await res.json()) as { error?: { message?: string } }
    return {
      name: label,
      ok: res.ok,
      status: res.status,
      detail: body.error?.message || (res.ok ? 'ok' : 'non-ok'),
    }
  } catch (err) {
    return {
      name: label,
      ok: false,
      status: 'network_error',
      detail: err instanceof Error ? err.message : 'unknown',
    }
  }
}

async function checkAnthropic(key: string | undefined): Promise<CheckResult> {
  const label = 'ANTHROPIC_API_KEY'
  if (!key) return { name: label, ok: false, status: 'not_configured', detail: 'missing' }
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 5,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    })
    const body = (await res.json()) as { error?: { message?: string; type?: string } }
    return {
      name: label,
      ok: res.ok,
      status: res.status,
      detail: body.error?.message || (res.ok ? 'ok' : 'non-ok'),
    }
  } catch (err) {
    return {
      name: label,
      ok: false,
      status: 'network_error',
      detail: err instanceof Error ? err.message : 'unknown',
    }
  }
}

async function checkOpenAI(key: string | undefined): Promise<CheckResult> {
  const label = 'OPENAI_API_KEY'
  if (!key) return { name: label, ok: false, status: 'not_configured', detail: 'missing' }
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
    })
    const body = (await res.json()) as { error?: { message?: string } }
    return {
      name: label,
      ok: res.ok,
      status: res.status,
      detail: body.error?.message || (res.ok ? 'ok' : 'non-ok'),
    }
  } catch (err) {
    return {
      name: label,
      ok: false,
      status: 'network_error',
      detail: err instanceof Error ? err.message : 'unknown',
    }
  }
}

async function main() {
  const results: CheckResult[] = []
  results.push(await checkGemini(process.env.GEMINI_API_KEY, 'GEMINI_API_KEY'))
  if (process.env.GEMINI_API_KEY_2) {
    results.push(await checkGemini(process.env.GEMINI_API_KEY_2, 'GEMINI_API_KEY_2'))
  }
  if (process.env.GEMINI_API_KEY_3) {
    results.push(await checkGemini(process.env.GEMINI_API_KEY_3, 'GEMINI_API_KEY_3'))
  }
  results.push(await checkAnthropic(process.env.ANTHROPIC_API_KEY))
  results.push(await checkOpenAI(process.env.OPENAI_API_KEY))

  console.log('\n=== AI provider key health ===')
  for (const r of results) {
    const mark = r.ok ? 'OK  ' : 'FAIL'
    console.log(`[${mark}] ${r.name.padEnd(22)} status=${String(r.status).padEnd(8)} ${r.detail}`)
  }
  const anyFail = results.some((r) => !r.ok)
  process.exit(anyFail ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
