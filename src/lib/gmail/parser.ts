export type JobStatus = 'Applied' | 'Screening' | 'Interview' | 'Offer' | 'Rejected'

type ParsedJobSignal = {
  subject: string
  from: string
  company: string | null
  inferredStatus: JobStatus | null
}

export type EmailDirection = 'outbound' | 'inbound' | 'unknown'

export type HeuristicResult = {
  status: JobStatus | null
  company: string | null
  confidence: number
}

const HIGH_CONFIDENCE_PATTERNS: Array<{ rx: RegExp; status: JobStatus; w: number }> = [
  { rx: /\b(congratulations|you'?re hired|offer of employment|job offer)\b/i,                         status: 'Offer',      w: 0.95 },
  { rx: /\b(unfortunately|not (?:moving forward|selected)|regret to inform|not a fit)\b/i,           status: 'Rejected',   w: 0.92 },
  { rx: /\b(interview (?:invitation|scheduled|confirmed)|schedule (?:a|your) (?:call|interview))\b/i, status: 'Interview',  w: 0.90 },
  { rx: /\b(online assessment|coding challenge|take-?home|hackerrank|codility)\b/i,                  status: 'Screening',  w: 0.88 },
  { rx: /\b(application received|thank you for applying|we(?:'| have)? received your application)\b/i, status: 'Applied',  w: 0.85 },
]

function inferStatusFromSubject(subject: string): JobStatus | null {
  const v = subject.toLowerCase()

  if (
    v.includes('regret') ||
    v.includes('unfortunately') ||
    v.includes('rejected') ||
    v.includes('withdrawn') ||
    v.includes('no longer considering') ||
    v.includes('decided to move forward with other') ||
    v.includes('not moving forward')
  ) return 'Rejected'
  if (v.includes('offer')) return 'Offer'
  if (v.includes('congratulations') || v.includes('congrats')) return 'Offer'
  if (v.includes('interview')) return 'Interview'
  if (v.includes('assessment') || v.includes('screen')) return 'Screening'
  if (v.includes('application') || v.includes('applied')) return 'Applied'

  return null
}

function extractCompanyFromDomain(from: string): string | null {
  const m = from.match(/@([^.]+)\./)
  if (!m) return null
  const domain = m[1]
  return domain.charAt(0).toUpperCase() + domain.slice(1)
}

function inferCompanyFromSubject(subject: string): string | null {
  const m = subject.match(/\bat\s+([A-Za-z0-9][A-Za-z0-9&. -]{1,40})/i)
  if (!m) return null
  let company = m[1].trim()
  // Trim at separator chars (em-dash, colon, pipe, comma, hyphen-space)
  company = company.split(/[—:|,]| - /)[0].trim()
  // Strip trailing legal suffixes
  company = company.replace(/\s+(?:Inc|LLC|Corp|Ltd|Pvt|Private|Limited|Co)\.?\s*$/i, '').trim()
  return company || null
}

export function inferFromSubject(subject: string, from: string): HeuristicResult {
  for (const p of HIGH_CONFIDENCE_PATTERNS) {
    if (p.rx.test(subject)) {
      const company = inferCompanyFromSubject(subject) || extractCompanyFromDomain(from)
      return { status: p.status, company, confidence: p.w }
    }
  }
  return { status: null, company: null, confidence: 0 }
}

export function parseJobSignal(params: { subject?: string; from?: string }) {
  const subject = params.subject?.trim() || ''
  const from = params.from?.trim() || ''

  const result: ParsedJobSignal = {
    subject,
    from,
    company: inferCompanyFromSubject(subject),
    inferredStatus: inferStatusFromSubject(subject),
  }

  return result
}

// RFC 5322 compliant email validation
// Pattern: local-part@domain with at least one dot in domain
// Allows alphanumeric, dots, hyphens, underscores in local part
// Domain must have at least one dot and valid TLD
const EMAIL_REGEX = /^[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

export function extractEmailAddress(value?: string | null) {
  if (!value) return null
  const trimmed = value.trim()
  const bracket = trimmed.match(/<([^>]+)>/)
  const candidate = (bracket?.[1] || trimmed).trim().toLowerCase()
  
  // Validate format
  if (!EMAIL_REGEX.test(candidate)) return null
  
  // Reject obviously invalid patterns
  if (candidate.includes('..') || candidate.startsWith('.') || candidate.endsWith('.')) return null
  if (candidate.split('@')[0].length === 0 || candidate.split('@')[1].length === 0) return null
  
  return candidate
}

export function inferEmailDirection(params: { from?: string; userEmail?: string | null }): EmailDirection {
  const fromEmail = extractEmailAddress(params.from)
  const userEmail = extractEmailAddress(params.userEmail || '')
  if (!fromEmail || !userEmail) return 'unknown'
  return fromEmail === userEmail ? 'outbound' : 'inbound'
}
