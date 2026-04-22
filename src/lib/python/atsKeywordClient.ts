type PythonATSKeywordResponse = {
  keywordMatches?: string[]
  missingKeywords?: string[]
}

const REQUEST_TIMEOUT_MS = 700

function normalizeKeywordList(value: unknown) {
  if (!Array.isArray(value)) return []

  const unique = new Set<string>()

  for (const item of value) {
    if (typeof item !== 'string') continue

    const normalized = item.trim().toLowerCase()
    if (!normalized) continue
    unique.add(normalized)

    if (unique.size >= 10) break
  }

  return [...unique]
}

export async function getPythonATSKeywordDiff(resumeText: string, jobDescription: string) {
  const serviceUrl = process.env.PYTHON_NLP_SERVICE_URL?.trim()
  if (!serviceUrl) return null

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${serviceUrl.replace(/\/$/, '')}/v1/nlp/ats-keywords`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        resumeText,
        jobDescription,
        limit: 10,
      }),
      signal: controller.signal,
      cache: 'no-store',
    })

    if (!response.ok) return null

    const payload = (await response.json()) as PythonATSKeywordResponse

    const keywordMatches = normalizeKeywordList(payload.keywordMatches)
    const missingKeywords = normalizeKeywordList(payload.missingKeywords)

    if (keywordMatches.length === 0 && missingKeywords.length === 0) {
      return null
    }

    return {
      keywordMatches,
      missingKeywords,
    }
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}
