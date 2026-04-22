type GmailListResponse = {
  messages?: Array<{ id: string; threadId: string }>
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

const DEFAULT_SYNC_QUERY = 'subject:(job OR interview OR application)'

/** Gmail API allows up to 500 results per list request. */
const GMAIL_LIST_MAX_PAGE = 500

export type GmailSyncListConfig = {
  query: string
  pageSize: number
  maxMessages: number
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
export async function listGmailMessageRefsForSync(accessToken: string): Promise<Array<{ id: string; threadId: string }>> {
  const { query, pageSize, maxMessages } = getGmailSyncListConfig()
  const refs: Array<{ id: string; threadId: string }> = []
  let pageToken: string | undefined

  while (refs.length < maxMessages) {
    const remaining = maxMessages - refs.length
    const batchSize = Math.min(pageSize, GMAIL_LIST_MAX_PAGE, remaining)
    const page = await listGmailMessages(accessToken, query, batchSize, pageToken)
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
