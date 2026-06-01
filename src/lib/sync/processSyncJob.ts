import { createHash } from 'crypto'
import {
  buildSyncQueryWithLocalDateRange,
  extractGmailMessageBody,
  getGmailMessage,
  getGmailProfile,
  getGmailSyncListConfig,
  listGmailMessageRefsForSync,
  listGmailMessageRefsFromHistory,
} from '@/lib/gmail/client'
import { inferEmailDirection } from '@/lib/gmail/parser'
import { getAllValidGmailAccessTokens } from '@/lib/gmail/token'
import { isAtsSender } from '@/lib/extraction/atsAllowlist'
import { processExtractionJob } from '@/lib/extraction/processExtractionJob'
import { shouldFastSkip } from '@/lib/extraction/fastSkip'
import { markAutoRejected } from '@/lib/extraction/upsert'
import { enqueueExtractionJob } from '@/lib/queue/extractionQueue'
import { type SyncJobPayload } from '@/lib/queue/syncQueue'
import { recordAuditEvent } from '@/lib/security/audit'
import { decryptSecret } from '@/lib/security/encryption'
import { refreshSyncLock, releaseSyncLock } from '@/lib/security/syncLock'
import { createServiceClient } from '@/lib/supabase/service'

type SyncStatusRow = {
  id: string
  started_at: string | null
}

const SYNC_MESSAGE_FETCH_CHUNK = 10
// Gmail body bytes above this cap are almost always HTML newsletters.
// ATS senders are exempt — they sometimes send long offer-letter emails.
const BODY_NOISE_THRESHOLD_BYTES = 50_000
// Gmail tabs that almost never carry lifecycle emails. ATS senders are
// exempt because Workday/Greenhouse occasionally land in CATEGORY_UPDATES.
const NOISY_GMAIL_LABELS = new Set([
  'CATEGORY_PROMOTIONS',
  'CATEGORY_SOCIAL',
  'CATEGORY_FORUMS',
])
// Backfill ranges wider than this are split into successive sub-windows
// so the GMAIL_SYNC_MAX_MESSAGES cap doesn't silently drop older mail.
const RANGE_CHUNK_DAYS = 30
const RANGE_CHUNK_THRESHOLD_DAYS = 60

function gmailListQueryWithoutRecencyCap() {
  const { query: defaultSyncQuery } = getGmailSyncListConfig()
  const stripped = defaultSyncQuery
    .replace(/\s*newer_than:\d+[dmy]\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return stripped || defaultSyncQuery
}

function getHeaderValue(
  headers: Array<{ name: string; value: string }> | undefined,
  name: string
) {
  return headers?.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value || ''
}

function hashEmailContent(fromAddress: string, subject: string, body: string) {
  return createHash('sha256')
    .update(`${fromAddress.toLowerCase()}|${subject.trim().toLowerCase()}|${body.slice(0, 500)}`)
    .digest('hex')
}

type SyncFetchedMessage = {
  messageRef: { id: string; threadId?: string }
  message: Awaited<ReturnType<typeof getGmailMessage>>
  fromAddress: string
  subject: string
  toAddress: string | null
  ccAddress: string | null
  bccAddress: string | null
  body: string
  snippet: string
  receivedAtIso: string
  receivedAtMs: number
  contentHash: string
  emailDirection: ReturnType<typeof inferEmailDirection>
  gmailThreadId: string | null
  labels: string[]
  fromIsAts: boolean
}

/** True when another row (DB or earlier in this batch) shares the same content hash. */
function isDuplicateContentHash(
  gmailMessageId: string,
  contentHash: string,
  existingByHash: Map<string, Set<string>>,
  seenInBatch: Map<string, string>
) {
  const existing = existingByHash.get(contentHash)
  if (existing) {
    for (const id of existing) {
      if (id !== gmailMessageId) return true
    }
  }
  const firstInBatch = seenInBatch.get(contentHash)
  if (firstInBatch && firstInBatch !== gmailMessageId) return true
  return false
}

async function loadExistingContentHashesByHash(
  userId: string,
  hashes: string[]
): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>()
  if (hashes.length === 0) return map

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('processed_emails')
    .select('content_hash, gmail_message_id')
    .eq('user_id', userId)
    .in('content_hash', hashes)

  for (const row of data || []) {
    if (!row.content_hash) continue
    if (!map.has(row.content_hash)) map.set(row.content_hash, new Set())
    map.get(row.content_hash)!.add(row.gmail_message_id)
  }
  return map
}

async function getLatestSyncStatusRow(userId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('sync_status')
    .select('id,started_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<SyncStatusRow>()
  return data
}

async function updateSyncStatus(
  statusRowId: string,
  patch: {
    status?: 'in_progress' | 'completed' | 'failed'
    total_emails?: number
    processed_count?: number
    new_jobs_found?: number
    error_message?: string | null
    started_at?: string
    completed_at?: string
    truncated?: boolean
    oldest_processed_at?: string | null
    extraction_mode?: string | null
  }
) {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('sync_status')
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq('id', statusRowId)
  if (error) {
    console.error('[sync] sync_status update failed', statusRowId, error.message)
  }
}

// --- date helpers for monthly chunking -----------------------------------

function parseYmd(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return Number.isNaN(date.getTime()) ? null : date
}

function formatYmd(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function dayDiff(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

/**
 * Splits [from, to] into ascending sub-windows of at most RANGE_CHUNK_DAYS.
 * Each window is processed sequentially so GMAIL_SYNC_MAX_MESSAGES caps
 * truncate per-window rather than dropping the oldest mail silently.
 */
function buildDateChunks(
  fromDate: string | undefined,
  toDate: string | undefined
): Array<{ fromDate?: string; toDate?: string }> {
  if (!fromDate && !toDate) return [{ fromDate, toDate }]

  const fromD = fromDate ? parseYmd(fromDate) : null
  const toD: Date = toDate ? parseYmd(toDate) || new Date() : new Date()
  if (!fromD) return [{ fromDate, toDate }]

  const span = dayDiff(fromD, toD)
  if (span <= RANGE_CHUNK_THRESHOLD_DAYS) return [{ fromDate, toDate }]

  const chunks: Array<{ fromDate?: string; toDate?: string }> = []
  let cursor = new Date(fromD.getTime())
  const endMs = toD.getTime()
  while (cursor.getTime() <= endMs) {
    const next = new Date(cursor.getTime() + RANGE_CHUNK_DAYS * 86_400_000)
    const chunkEnd = next.getTime() > endMs ? toD : next
    chunks.push({
      fromDate: formatYmd(cursor),
      toDate: formatYmd(chunkEnd),
    })
    if (chunkEnd.getTime() === endMs) break
    cursor = new Date(chunkEnd.getTime() + 86_400_000)
  }
  return chunks
}

/**
 * Keep only the most recent message per thread within a single fetch
 * batch. Gmail `messages.list` is newest-first, so the **lowest index**
 * per threadId is the freshest lifecycle state (not the last index).
 */
function dedupeRefsByThread(
  refs: Array<{ id: string; threadId?: string }>
): Array<{ id: string; threadId?: string }> {
  const newestIdxByThread = new Map<string, number>()
  refs.forEach((ref, idx) => {
    const key = ref.threadId || ref.id
    const prev = newestIdxByThread.get(key)
    if (prev === undefined || idx < prev) {
      newestIdxByThread.set(key, idx)
    }
  })
  return refs.filter((ref, idx) => {
    const key = ref.threadId || ref.id
    return newestIdxByThread.get(key) === idx
  })
}

function getEmailFromIdToken(idTokenEncrypted?: string | null) {
  if (!idTokenEncrypted) return null
  try {
    const token = decryptSecret(idTokenEncrypted)
    const payload = token.split('.')[1]
    if (!payload) {
      console.warn('[sync] id_token missing payload section')
      return null
    }
    const decoded = payload.replace(/-/g, '+').replace(/_/g, '/')
    const parsed = JSON.parse(Buffer.from(decoded, 'base64').toString('utf8')) as { email?: string }
    const email = parsed.email || null
    
    if (!email) {
      console.warn('[sync] id_token missing email claim')
      return null
    }
    
    return email
  } catch (err) {
    console.warn('[sync] id_token decrypt/decode failed; outbound detection may be unknown', err)
    return null
  }
}

export async function processSyncJob(payload: SyncJobPayload) {
  const supabase = createServiceClient()
  const statusRow = await getLatestSyncStatusRow(payload.userId)
  const syncStartedAt = statusRow?.started_at || new Date().toISOString()
  const lockRefreshTimer = setInterval(() => {
    refreshSyncLock(payload.userId).catch(() => {})
  }, 60_000)

  try {
    const allTokens = await getAllValidGmailAccessTokens(payload.userId)
    if (allTokens.length === 0) {
      throw new Error('No valid Gmail connections found. Please connect an account.')
    }

    if (statusRow) {
      await updateSyncStatus(statusRow.id, {
        status: 'in_progress',
        processed_count: 0,
        new_jobs_found: 0,
        error_message: null,
        started_at: syncStartedAt,
      })
    }

    let processedCount = 0
    let totalEmails = 0
    let isStopped = false
    let truncated = false
    let oldestProcessedAtMs: number | null = null
    const { maxMessages: gmailMaxMessages } = getGmailSyncListConfig()
    const idTokenAuditOnce = new Set<string>()

    for (const tokenData of allTokens) {
      const { accessToken, idTokenEncrypted, lastHistoryId } = tokenData
      const userEmail = getEmailFromIdToken(idTokenEncrypted)
      if (!userEmail && idTokenEncrypted && !idTokenAuditOnce.has(tokenData.tokenId)) {
        idTokenAuditOnce.add(tokenData.tokenId)
        await recordAuditEvent({
          userId: payload.userId,
          eventType: 'sync_gmail_id_token_unavailable',
          action: 'sync_process',
          resourceType: 'oauth_tokens',
          resourceId: tokenData.tokenId,
          newValues: { note: 'Cannot decode Gmail id_token; outbound detection may be unknown.' },
        }).catch(() => {})
      }
      const hasCustomRange = Boolean(payload.fromDate || payload.toDate)
      // Use the same tight ATS/job keyword query for range syncs.
      // The old '-category:{promotions social forums}' fetched every non-promo
      // email in the date window — potentially thousands of irrelevant messages.
      const { query: defaultSyncQuery } = getGmailSyncListConfig()
      // Strip baked-in `newer_than:Nd` clauses when the user picks an explicit
      // range. Otherwise an old fromDate (e.g. 1 year ago) intersects with
      // newer_than:90d and Gmail returns nothing.
      const rangeBaseQuery = (
        process.env.GMAIL_SYNC_RANGE_QUERY?.trim() || defaultSyncQuery
      )
        .replace(/\s*newer_than:\d+[dmy]\s*/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      // Long custom-range syncs are split into successive RANGE_CHUNK_DAYS
      // windows so the per-fetch cap doesn't drop the oldest mail silently.
      const dateChunks = hasCustomRange
        ? buildDateChunks(payload.fromDate, payload.toDate)
        : [{ fromDate: undefined as string | undefined, toDate: undefined as string | undefined }]

      for (const chunk of dateChunks) {
        if (isStopped) break

        const customRangeQuery = hasCustomRange
          ? buildSyncQueryWithLocalDateRange({
              baseQuery: rangeBaseQuery,
              fromDate: chunk.fromDate,
              toDate: chunk.toDate,
              timezoneOffsetMinutes: payload.timezoneOffsetMinutes,
            })
          : ''

        let messageRefs: Array<{ id: string; threadId?: string }> = []
        try {
          if (hasCustomRange) {
            messageRefs = await listGmailMessageRefsForSync(accessToken, {
              queryOverride: customRangeQuery,
            })
          } else if (lastHistoryId) {
            try {
              messageRefs = await listGmailMessageRefsFromHistory(accessToken, lastHistoryId)
            } catch (historyError) {
              const message = historyError instanceof Error ? historyError.message : 'history_sync_failed'
              const historyInvalid =
                message.includes('(404)') || message.toLowerCase().includes('start historyid')
              if (historyInvalid) {
                messageRefs = await listGmailMessageRefsForSync(accessToken, {
                  queryOverride: gmailListQueryWithoutRecencyCap(),
                })
              } else {
                throw historyError
              }
            }
          } else {
            messageRefs = await listGmailMessageRefsForSync(accessToken, {
              queryOverride: gmailListQueryWithoutRecencyCap(),
            })
          }
        } catch (err) {
          console.error(`Failed to list messages for connection ${tokenData.tokenId}:`, err)
          await recordAuditEvent({
            userId: payload.userId,
            eventType: 'sync_account_failed',
            action: 'sync_process',
            resourceType: 'oauth_tokens',
            resourceId: tokenData.tokenId,
            newValues: {
              email: userEmail,
              error: err instanceof Error ? err.message : 'unknown',
              chunk,
            },
          })
          continue
        }

        // Hitting the per-fetch cap means Gmail had more matching mail than
        // we read. Surface this on sync_status so the user can re-run the
        // sync narrowed to the oldest message returned.
        if (messageRefs.length >= gmailMaxMessages) {
          truncated = true
        }

        // Per-fetch thread dedupe: keep only the latest message per thread
        // so multi-message ATS threads don't burn one LLM call per reply.
        messageRefs = dedupeRefsByThread(messageRefs)

        totalEmails += messageRefs.length
        if (statusRow) {
          await updateSyncStatus(statusRow.id, { total_emails: totalEmails })
        }

        const refIds = messageRefs.map((ref) => ref.id)
        const { data: alreadyRows } = refIds.length
          ? await supabase
              .from('processed_emails')
              .select('gmail_message_id')
              .eq('user_id', payload.userId)
              .in('gmail_message_id', refIds)
          : { data: [] as Array<{ gmail_message_id: string }> }

        const processedSet = new Set((alreadyRows || []).map((row) => row.gmail_message_id))
        const pendingRefs = payload.force
          ? messageRefs
          : messageRefs.filter((ref) => !processedSet.has(ref.id))

        if (!payload.force) {
          processedCount += messageRefs.length - pendingRefs.length
        }

        for (let i = 0; i < pendingRefs.length; i += SYNC_MESSAGE_FETCH_CHUNK) {
          if (statusRow) {
            const { data: currentStatus } = await supabase
              .from('sync_status')
              .select('status')
              .eq('id', statusRow.id)
              .single()
            if (currentStatus?.status === 'stopped') {
              isStopped = true
              break
            }
          }

          const fetchBatch = pendingRefs.slice(i, i + SYNC_MESSAGE_FETCH_CHUNK)

          const fetchResults = await Promise.all(
            fetchBatch.map(async (messageRef) => {
              try {
                const message = await getGmailMessage(accessToken, messageRef.id)
                const fromAddress = getHeaderValue(message.payload?.headers, 'From')
                const subject = getHeaderValue(message.payload?.headers, 'Subject')
                const toAddress = getHeaderValue(message.payload?.headers, 'To') || null
                const ccAddress = getHeaderValue(message.payload?.headers, 'Cc') || null
                const bccAddress = getHeaderValue(message.payload?.headers, 'Bcc') || null
                const body = extractGmailMessageBody(message) || ''
                const snippet = message.snippet || ''
                const receivedAtIso = message.internalDate
                  ? new Date(Number(message.internalDate)).toISOString()
                  : new Date().toISOString()
                const receivedAtMs = Date.parse(receivedAtIso)
                const contentHash = hashEmailContent(fromAddress || 'unknown', subject || '', body)
                const emailDirection = inferEmailDirection({ from: fromAddress, userEmail })
                const gmailThreadId = message.threadId || messageRef.threadId || null
                const labels = message.labelIds || []
                const fromIsAts = isAtsSender(fromAddress)

                return {
                  ok: true as const,
                  item: {
                    messageRef,
                    message,
                    fromAddress,
                    subject,
                    toAddress,
                    ccAddress,
                    bccAddress,
                    body,
                    snippet,
                    receivedAtIso,
                    receivedAtMs,
                    contentHash,
                    emailDirection,
                    gmailThreadId,
                    labels,
                    fromIsAts,
                  } satisfies SyncFetchedMessage,
                }
              } catch (err) {
                console.error('Sync message fetch failed:', err)
                return { ok: false as const }
              }
            })
          )

          const fetched: SyncFetchedMessage[] = []
          for (const result of fetchResults) {
            if (!result.ok) continue
            const item = result.item
            if (Number.isFinite(item.receivedAtMs)) {
              if (oldestProcessedAtMs === null || item.receivedAtMs < oldestProcessedAtMs) {
                oldestProcessedAtMs = item.receivedAtMs
              }
            }
            fetched.push(item)
          }

          const hashCandidates = fetched.filter((item) => {
            if (item.emailDirection === 'outbound') return false
            if (!item.fromIsAts && item.labels.some((l) => NOISY_GMAIL_LABELS.has(l))) return false
            if (!item.fromIsAts && item.body.length > BODY_NOISE_THRESHOLD_BYTES) return false
            return true
          })
          const uniqueHashes = [...new Set(hashCandidates.map((item) => item.contentHash))]
          const existingByHash = payload.force
            ? new Map<string, Set<string>>()
            : await loadExistingContentHashesByHash(payload.userId, uniqueHashes)
          const seenInBatch = new Map<string, string>()

          const results = await Promise.all(
            fetched.map(async (item) => {
              try {
                const {
                  message,
                  fromAddress,
                  subject,
                  toAddress,
                  ccAddress,
                  bccAddress,
                  body,
                  snippet,
                  receivedAtIso,
                  contentHash,
                  emailDirection,
                  gmailThreadId,
                  labels,
                  fromIsAts,
                } = item
                const envelope = { toAddress, ccAddress, bccAddress, snippet, receivedAt: receivedAtIso }

                if (emailDirection === 'outbound') {
                  await markAutoRejected({
                    userId: payload.userId,
                    gmailMessageId: message.id,
                    gmailThreadId,
                    fromAddress,
                    subject,
                    contentHash,
                    reason: 'outbound_email',
                    ...envelope,
                  })
                  return { processed: true }
                }

                if (!fromIsAts && labels.some((l) => NOISY_GMAIL_LABELS.has(l))) {
                  await markAutoRejected({
                    userId: payload.userId,
                    gmailMessageId: message.id,
                    gmailThreadId,
                    fromAddress,
                    subject,
                    contentHash,
                    reason: `gmail_category:${labels.filter((l) => NOISY_GMAIL_LABELS.has(l)).join(',')}`,
                    ...envelope,
                  })
                  return { processed: true }
                }

                if (!fromIsAts && body.length > BODY_NOISE_THRESHOLD_BYTES) {
                  await markAutoRejected({
                    userId: payload.userId,
                    gmailMessageId: message.id,
                    gmailThreadId,
                    fromAddress,
                    subject,
                    contentHash,
                    reason: `body_too_large:${body.length}b`,
                    ...envelope,
                  })
                  return { processed: true }
                }

                if (
                  !payload.force &&
                  isDuplicateContentHash(message.id, contentHash, existingByHash, seenInBatch)
                ) {
                  await markAutoRejected({
                    userId: payload.userId,
                    gmailMessageId: message.id,
                    gmailThreadId,
                    fromAddress,
                    subject,
                    contentHash,
                    reason: 'duplicate_content',
                    ...envelope,
                  })
                  return { processed: true }
                }
                seenInBatch.set(contentHash, message.id)

                const fastSkip = shouldFastSkip({ subject, from: fromAddress, snippet })
                if (fastSkip.skip) {
                  await markAutoRejected({
                    userId: payload.userId,
                    gmailMessageId: message.id,
                    gmailThreadId,
                    fromAddress,
                    subject,
                    contentHash,
                    reason: fastSkip.reason || 'fast_skip',
                    ...envelope,
                  })
                  return { processed: true }
                }

                const extractionPayload = {
                  userId: payload.userId,
                  email: {
                    gmailMessageId: message.id,
                    from: fromAddress,
                    subject,
                    snippet,
                    bodyText: body,
                    receivedAtIso,
                    contentHash,
                    emailDirection,
                    toAddress,
                    ccAddress,
                    bccAddress,
                  },
                  ...(payload.extractionMode ? { extractionMode: payload.extractionMode } : {}),
                }

                try {
                  await enqueueExtractionJob(extractionPayload)
                  return { processed: true }
                } catch (queueError) {
                  if (process.env.NODE_ENV !== 'production') {
                    console.warn(
                      'Extraction queue unavailable — processing inline (dev mode only)',
                      queueError
                    )
                    await processExtractionJob(extractionPayload)
                    return { processed: true }
                  }
                  throw queueError
                }
              } catch (err) {
                console.error('Sync message processing failed:', err)
                return { processed: false }
              }
            })
          )

          processedCount += results.filter((r) => r.processed).length

          if (statusRow && (processedCount === totalEmails || processedCount % 5 === 0)) {
            await updateSyncStatus(statusRow.id, {
              processed_count: processedCount,
            })
          }
        }

        if (isStopped) break
      }

      if (isStopped) break

      // Update Gmail history cursor for incremental syncs.
      try {
        const profile = await getGmailProfile(accessToken)
        if (profile.historyId) {
          await supabase
            .from('oauth_tokens')
            .update({ last_history_id: profile.historyId, updated_at: new Date().toISOString() })
            .eq('id', tokenData.tokenId)
            .eq('user_id', payload.userId)
            .eq('provider', 'google_gmail')
        }
      } catch {
        // Best-effort cursor update.
      }
    }

    const effectiveMode = payload.extractionMode || process.env.EXTRACTION_MODE || 'balanced'
    const oldestProcessedAtIso = oldestProcessedAtMs
      ? new Date(oldestProcessedAtMs).toISOString()
      : null

    // Net-new application rows from this sync (not "emails auto-accepted", which includes updates).
    const { count: newGmailJobsCount } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', payload.userId)
      .eq('source', 'gmail_sync')
      .gte('created_at', syncStartedAt)

    const newJobsFound = newGmailJobsCount ?? 0

    if (statusRow && !isStopped) {
      await updateSyncStatus(statusRow.id, {
        status: 'completed',
        processed_count: processedCount,
        new_jobs_found: newJobsFound,
        completed_at: new Date().toISOString(),
        truncated,
        oldest_processed_at: oldestProcessedAtIso,
        extraction_mode: effectiveMode,
      })
    }

    await recordAuditEvent({
      userId: payload.userId,
      eventType: 'sync_worker_completed',
      action: 'sync_process',
      resourceType: 'sync_status',
      resourceId: statusRow?.id,
      newValues: {
        processedCount,
        newJobsFound,
        mode: effectiveMode,
        truncated,
        oldestProcessedAt: oldestProcessedAtIso,
      },
    })
  } catch (error) {
    if (statusRow) {
      await updateSyncStatus(statusRow.id, {
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Sync failed',
        completed_at: new Date().toISOString(),
      })
    }

    await recordAuditEvent({
      userId: payload.userId,
      eventType: 'sync_worker_failed',
      action: 'sync_process',
      resourceType: 'sync_status',
      resourceId: statusRow?.id,
      newValues: {
        error: error instanceof Error ? error.message : 'unknown',
      },
    })

    throw error
  } finally {
    clearInterval(lockRefreshTimer)
    await releaseSyncLock(payload.userId).catch((err) =>
      console.error('[sync] releaseSyncLock failed', payload.userId, err)
    )
  }
}

// Note: the full pipeline now lives in `@/lib/extraction/processExtractionJob`.
// Stage 1 classifier, Stage 2 extractor, Stage 3 verifier, and the fuzzy upsert
// have been unified there and are mode-driven via `getExtractionConfig()`.
// This sync worker is now a pure fetcher + fast-skip + dispatcher.
