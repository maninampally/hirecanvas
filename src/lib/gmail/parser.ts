type ParsedJobSignal = {
  subject: string
  from: string
  company: string | null
  inferredStatus: 'Applied' | 'Screening' | 'Interview' | 'Offer' | null
}

function inferStatusFromSubject(subject: string): ParsedJobSignal['inferredStatus'] {
  const value = subject.toLowerCase()

  if (value.includes('offer')) return 'Offer'
  if (value.includes('interview')) return 'Interview'
  if (value.includes('assessment') || value.includes('screen')) return 'Screening'
  if (value.includes('application') || value.includes('applied')) return 'Applied'

  return null
}

function inferCompanyFromSubject(subject: string) {
  const match = subject.match(/at\s+([A-Za-z0-9&.\-\s]{2,})/i)
  return match?.[1]?.trim() || null
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
