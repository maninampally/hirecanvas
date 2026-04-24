type GmailListResponse = {
  messages?: Array<{ id: string; threadId: string }>
  nextPageToken?: string
}

type GmailProfileResponse = {
  historyId?: string
}

type GmailHistoryResponse = {
  history?: Array<{
    messagesAdded?: Array<{ message?: { id?: string; threadId?: string } }>
  }>
  nextPageToken?: string
}

type GmailMessageResponse = {
  id: string
  threadId: string
  snippet?: string
  payload?: {
    mimeType?: string
    body?: {
      data?: string
    }
    parts?: GmailMessagePart[]
    headers?: Array<{ name: string; value: string }>
  }
  internalDate?: string
}

type GmailMessagePart = {
  mimeType?: string
  body?: {
    data?: string
  }
  parts?: GmailMessagePart[]
}

type GoogleApiErrorBody = {
  error?: {
    message?: string
    status?: string
  }
}

function getAuthHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
  }
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  return Buffer.from(padded, 'base64').toString('utf8')
}

function htmlToText(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function findPartDataByMimeType(part: GmailMessagePart | undefined, mimeType: string): string | null {
  if (!part) return null

  if (part.mimeType?.toLowerCase() === mimeType && part.body?.data) {
    return part.body.data
  }

  for (const child of part.parts || []) {
    const found = findPartDataByMimeType(child, mimeType)
    if (found) return found
  }

  return null
}

export function extractGmailMessageBody(message: GmailMessageResponse): string | null {
  const payload = message.payload
  if (!payload) return null

  const plainData = findPartDataByMimeType(payload as GmailMessagePart, 'text/plain')
  if (plainData) {
    const decoded = decodeBase64Url(plainData).trim()
    if (decoded) return decoded
  }

  if (payload.mimeType?.toLowerCase() === 'text/plain' && payload.body?.data) {
    const decoded = decodeBase64Url(payload.body.data).trim()
    if (decoded) return decoded
  }

  const htmlData = findPartDataByMimeType(payload as GmailMessagePart, 'text/html')
  if (htmlData) {
    const decoded = decodeBase64Url(htmlData)
    const text = htmlToText(decoded)
    if (text) return text
  }

  if (payload.mimeType?.toLowerCase() === 'text/html' && payload.body?.data) {
    const decoded = decodeBase64Url(payload.body.data)
    const text = htmlToText(decoded)
    if (text) return text
  }

  if (payload.body?.data) {
    const decoded = decodeBase64Url(payload.body.data).trim()
    if (decoded) return decoded
  }

  return null
}

const DEFAULT_SYNC_QUERY = [
  '(',
  'subject:(',
    // Application confirmations — quoted phrases only, no single words
    '"application received" OR "application submitted" OR',
    '"thank you for applying" OR "we received your application" OR',
    '"application confirmation" OR "your application to" OR',
    '"your application for" OR "applied for" OR',
    // Interview — specific phrases, not just the word "interview"
    '"interview invitation" OR "interview scheduled" OR "interview confirmed" OR',
    '"schedule an interview" OR "schedule a call" OR "schedule your interview" OR',
    '"phone screen" OR "phone interview" OR',
    '"technical interview" OR "onsite interview" OR "video interview" OR',
    '"coding challenge" OR "technical assessment" OR "take-home assignment" OR',
    '"hiring assessment" OR "skills assessment" OR',
    // Offer / rejection — specific phrases
    '"offer letter" OR "job offer" OR "offer of employment" OR',
    '"we would like to offer" OR "pleased to offer" OR',
    '"not moving forward" OR "other candidates" OR',
    '"position has been filled" OR "regret to inform" OR',
    '"unfortunately we" OR "unfortunately, we" OR',
    // Status updates — specific phrases
    '"update on your application" OR "status of your application" OR',
    '"next steps in your application" OR "next steps for your application" OR',
    '"moving forward with your application"',
  ')',
  // ATS platform senders — always safe, these are always job emails
  'OR from:(',
    'greenhouse.io OR lever.co OR workday.com OR taleo.net OR icims.com OR',
    'smartrecruiters.com OR jobvite.com OR ashbyhq.com OR rippling.com OR',
    'recruitcrm.io OR myworkdayjobs.com OR bamboohr.com OR successfactors.com OR',
    'applytojob.com OR dover.com OR jazz.co OR recruitee.com OR',
    'careers.google.com OR hiring.amazon.com',
  ')',
  ')',
  '-from:me',
  '-label:SPAM',
  '-subject:("job alert" OR "jobs matching" OR "recommended jobs" OR',
    '"people also applied" OR "newsletter" OR "digest" OR',
    '"weekly roundup" OR "jobs near you" OR "new jobs matching")',
  'newer_than:90d',
].join(' ')

/** Gmail API allows up to 500 results per list request. */
const GMAIL_LIST_MAX_PAGE = 500

export type GmailSyncListConfig = {
  query: string
  pageSize: number
  maxMessages: number
}

function parseISODateInput(value?: string) {
  if (!value) return null
  const trimmed = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null
  const date = new Date(`${trimmed}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

function toGmailDateToken(date: Date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}/${month}/${day}`
}

export function buildSyncQueryWithDateRange(baseQuery: string, fromDate?: string, toDate?: string) {
  const from = parseISODateInput(fromDate)
  const to = parseISODateInput(toDate)

  const rangeTokens: string[] = []
  if (from) {
    rangeTokens.push(`after:${toGmailDateToken(from)}`)
  }
  if (to) {
    // Gmail before: is exclusive, so add 1 day to include the selected end date.
    const inclusiveEnd = new Date(to)
    inclusiveEnd.setUTCDate(inclusiveEnd.getUTCDate() + 1)
    rangeTokens.push(`before:${toGmailDateToken(inclusiveEnd)}`)
  }

  if (rangeTokens.length === 0) return baseQuery
  return `${baseQuery} ${rangeTokens.join(' ')}`.trim()
}

function toUnixSeconds(date: Date) {
  return Math.floor(date.getTime() / 1000)
}

export function buildSyncQueryWithLocalDateRange(params: {
  baseQuery: string
  fromDate?: string
  toDate?: string
  timezoneOffsetMinutes?: number
}) {
  const { baseQuery, fromDate, toDate, timezoneOffsetMinutes = 0 } = params
  const from = parseISODateInput(fromDate)
  const to = parseISODateInput(toDate)

  const rangeTokens: string[] = []
  if (from) {
    const fromUtcMs = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), 0, 0, 0)
      - timezoneOffsetMinutes * 60 * 1000
    rangeTokens.push(`after:${toUnixSeconds(new Date(fromUtcMs))}`)
  }
  if (to) {
    const exclusiveEndUtcMs =
      Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate() + 1, 0, 0, 0)
      - timezoneOffsetMinutes * 60 * 1000
    rangeTokens.push(`before:${toUnixSeconds(new Date(exclusiveEndUtcMs))}`)
  }

  if (rangeTokens.length === 0) return baseQuery
  return `${baseQuery} ${rangeTokens.join(' ')}`.trim()
}

export async function getGmailProfile(accessToken: string): Promise<GmailProfileResponse> {
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: getAuthHeaders(accessToken),
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch Gmail profile (${response.status})`)
  }

  return (await response.json()) as GmailProfileResponse
}

export async function listGmailMessageRefsFromHistory(
  accessToken: string,
  startHistoryId: string,
  maxMessages = 500
): Promise<Array<{ id: string; threadId: string }>> {
  const refs: Array<{ id: string; threadId: string }> = []
  const seen = new Set<string>()
  let pageToken: string | undefined

  while (refs.length < maxMessages) {
    const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/history')
    url.searchParams.set('startHistoryId', startHistoryId)
    url.searchParams.set('historyTypes', 'messageAdded')
    url.searchParams.set('maxResults', '200')
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken)
    }

    const response = await fetch(url.toString(), {
      headers: getAuthHeaders(accessToken),
    })

    if (!response.ok) {
      let detail = ''
      try {
        const body = (await response.json()) as GoogleApiErrorBody
        detail = body.error?.message || body.error?.status || ''
      } catch {
        detail = ''
      }
      throw new Error(
        detail
          ? `Failed to list Gmail history (${response.status}): ${detail}`
          : `Failed to list Gmail history (${response.status})`
      )
    }

    const payload = (await response.json()) as GmailHistoryResponse
    for (const historyItem of payload.history || []) {
      for (const added of historyItem.messagesAdded || []) {
        const message = added.message
        const id = message?.id
        const threadId = message?.threadId
        if (!id || !threadId || seen.has(id)) continue
        seen.add(id)
        refs.push({ id, threadId })
        if (refs.length >= maxMessages) break
      }
      if (refs.length >= maxMessages) break
    }

    if (!payload.nextPageToken) break
    pageToken = payload.nextPageToken
  }

  return refs.slice(0, maxMessages)
}

export function getGmailSyncListConfig(): GmailSyncListConfig {
  const rawQuery = process.env.GMAIL_SYNC_QUERY?.trim()
  const query = rawQuery && rawQuery.length > 0 ? rawQuery : DEFAULT_SYNC_QUERY

  const pageSizeRaw = Number(process.env.GMAIL_SYNC_PAGE_SIZE || '100')
  const pageSize = Number.isFinite(pageSizeRaw)
    ? Math.min(GMAIL_LIST_MAX_PAGE, Math.max(1, Math.floor(pageSizeRaw)))
    : 100

  const maxRaw = Number(process.env.GMAIL_SYNC_MAX_MESSAGES || '500')
  const maxMessages = Number.isFinite(maxRaw) ? Math.min(5000, Math.max(1, Math.floor(maxRaw))) : 500

  return { query, pageSize, maxMessages }
}

/**
 * Lists message id refs for sync: paginates until no nextPageToken or maxMessages is reached.
 * Uses {@link getGmailSyncListConfig} (GMAIL_SYNC_* env).
 */
export async function listGmailMessageRefsForSync(
  accessToken: string,
  options?: { queryOverride?: string }
): Promise<Array<{ id: string; threadId: string }>> {
  const { query, pageSize, maxMessages } = getGmailSyncListConfig()
  const effectiveQuery = options?.queryOverride?.trim() || query
  const refs: Array<{ id: string; threadId: string }> = []
  let pageToken: string | undefined

  while (refs.length < maxMessages) {
    const remaining = maxMessages - refs.length
    const batchSize = Math.min(pageSize, GMAIL_LIST_MAX_PAGE, remaining)
    const page = await listGmailMessages(accessToken, effectiveQuery, batchSize, pageToken)
    const batch = page.messages || []

    if (batch.length === 0) {
      break
    }

    refs.push(...batch)

    if (!page.nextPageToken) {
      break
    }

    pageToken = page.nextPageToken
  }

  return refs.slice(0, maxMessages)
}

export async function listGmailMessages(
  accessToken: string,
  query = DEFAULT_SYNC_QUERY,
  maxResults = 20,
  pageToken?: string
) {
  const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages')
  url.searchParams.set('q', query)
  url.searchParams.set('maxResults', String(Math.min(GMAIL_LIST_MAX_PAGE, Math.max(1, maxResults))))
  if (pageToken) {
    url.searchParams.set('pageToken', pageToken)
  }

  const response = await fetch(url.toString(), {
    headers: getAuthHeaders(accessToken),
  })

  if (!response.ok) {
    let detail = ''
    try {
      const body = (await response.json()) as GoogleApiErrorBody
      detail = body.error?.message || body.error?.status || ''
    } catch {
      detail = ''
    }

    throw new Error(
      detail
        ? `Failed to list Gmail messages (${response.status}): ${detail}`
        : `Failed to list Gmail messages (${response.status})`
    )
  }

  return (await response.json()) as GmailListResponse
}

export async function getGmailMessage(accessToken: string, messageId: string) {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`
  const response = await fetch(url, {
    headers: getAuthHeaders(accessToken),
  })

  if (!response.ok) {
    let detail = ''
    try {
      const body = (await response.json()) as GoogleApiErrorBody
      detail = body.error?.message || body.error?.status || ''
    } catch {
      detail = ''
    }

    throw new Error(
      detail
        ? `Failed to fetch Gmail message (${response.status}): ${detail}`
        : `Failed to fetch Gmail message (${response.status})`
    )
  }

  return (await response.json()) as GmailMessageResponse
}
