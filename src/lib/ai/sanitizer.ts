export type SanitizationResult = {
  sanitizedText: string
  piiFlags: string[]
  redactionCount: number
}

type PatternRule = {
  label: string
  pattern: RegExp
}

const PII_PATTERNS: PatternRule[] = [
  { label: 'ssn', pattern: /\b\d{3}-\d{2}-\d{4}\b/g },
  { label: 'credit_card', pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g },
  {
    label: 'credential_like',
    pattern: /\b(?:api[_-]?key|secret|token|password)\b\s*[:=]\s*[^\s,;]+/gi,
  },
]

export function sanitizeForAI(rawText: string): SanitizationResult {
  let sanitizedText = rawText
  const piiFlags = new Set<string>()
  let redactionCount = 0

  for (const rule of PII_PATTERNS) {
    const matches = sanitizedText.match(rule.pattern)
    if (matches && matches.length > 0) {
      piiFlags.add(rule.label)
      redactionCount += matches.length
      sanitizedText = sanitizedText.replace(rule.pattern, '[REDACTED]')
    }
  }

  return {
    sanitizedText,
    piiFlags: Array.from(piiFlags),
    redactionCount,
  }
}
