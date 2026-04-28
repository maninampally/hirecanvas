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
import { releaseSyncLock } from '@/lib/security/syncLock'
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
  await supabase
    .from('sync_status')
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq('id', statusRowId)
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
 * batch. ATS systems often emit 3-5 messages per thread (received →
 * reviewed → interview → offer); only the latest carries the freshest
 * lifecycle state, so we skip earlier messages to cut LLM cost.
 */
function dedupeRefsByThread(
  refs: Array<{ id: string; threadId?: string }>
): Array<{ id: string; threadId?: string }> {
  const lastIdxByThread = new Map<string, number>()
  refs.forEach((ref, idx) => {
    const key = ref.threadId || ref.id
    lastIdxByThread.set(key, idx)
  })
  return refs.filter((ref, idx) => {
    const key = ref.threadId || ref.id
    return lastIdxByThread.get(key) === idx
  })
}

function getEmailFromIdToken(idTokenEncrypted?: string | null) {
  if (!idTokenEncrypted) return null
  try {
    const token = decryptSecret(idTokenEncrypted)
    const payload = token.split('.')[1]
    if (!payload) return null
    const decoded = payload.replace(/-/g, '+').replace(/_/g, '/')
    const parsed = JSON.parse(Buffer.from(decoded, 'base64').toString('utf8')) as { email?: string }
    return parsed.email || null
  } catch {
    return null
  }
}

export async function processSyncJob(payload: SyncJobPayload) {
  const supabase = createServiceClient()
  const statusRow = await getLatestSyncStatusRow(payload.userId)
  const syncStartedAt = statusRow?.started_at || new Date().toISOString()

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
    let newJobsFound = 0
    let totalEmails = 0
    let isStopped = false
    let truncated = false
    let oldestProcessedAtMs: number | null = null
    const { maxMessages: gmailMaxMessages } = getGmailSyncListConfig()

    for (const tokenData of allTokens) {
      const { accessToken, idTokenEncrypted, lastHistoryId } = tokenData
      const userEmail = getEmailFromIdToken(idTokenEncrypted)
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
                messageRefs = await listGmailMessageRefsForSync(accessToken)
              } else {
                throw historyError
              }
            }
          } else {
            messageRefs = await listGmailMessageRefsForSync(accessToken)
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

          const results = await Promise.all(
            fetchBatch.map(async (messageRef) => {
              try {
                const message = await getGmailMessage(accessToken, messageRef.id)
                const fromAddress = getHeaderValue(message.payload?.headers, 'From')
                const subject = getHeaderValue(message.payload?.headers, 'Subject')
                const body = extractGmailMessageBody(message) || ''
                const snippet = message.snippet || ''
                const receivedAtIso = message.internalDate
                  ? new Date(Number(message.internalDate)).toISOString()
                  : new Date().toISOString()
                const receivedAtMs = Date.parse(receivedAtIso)
                if (Number.isFinite(receivedAtMs)) {
                  if (oldestProcessedAtMs === null || receivedAtMs < oldestProcessedAtMs) {
                    oldestProcessedAtMs = receivedAtMs
                  }
                }
                const contentHash = hashEmailContent(fromAddress || 'unknown', subject || '', body)
                const emailDirection = inferEmailDirection({ from: fromAddress, userEmail })
                const gmailThreadId = message.threadId || messageRef.threadId || null
                const labels = message.labelIds || []
                const fromIsAts = isAtsSender(fromAddress)

                // Skip emails the user sent — cover letters, follow-ups, thank-you notes
                // all contain job keywords but are outbound, not incoming status updates.
                if (emailDirection === 'outbound') {
                  await markAutoRejected({
                    userId: payload.userId,
                    gmailMessageId: message.id,
                    gmailThreadId,
                    fromAddress,
                    subject,
                    contentHash,
                    reason: 'outbound_email',
                  })
                  return { processed: true, createdJob: false }
                }

                // Gmail category skip — Promotions/Social/Forums tabs almost
                // never carry lifecycle mail. ATS senders bypass.
                if (!fromIsAts && labels.some((l) => NOISY_GMAIL_LABELS.has(l))) {
                  await markAutoRejected({
                    userId: payload.userId,
                    gmailMessageId: message.id,
                    gmailThreadId,
                    fromAddress,
                    subject,
                    contentHash,
                    reason: `gmail_category:${labels.filter((l) => NOISY_GMAIL_LABELS.has(l)).join(',')}`,
                  })
                  return { processed: true, createdJob: false }
                }

                // Body-size pre-filter — emails >50 KB are nearly always HTML
                // newsletters/digests. ATS senders are exempt because Workday
                // offer letters can be large.
                if (!fromIsAts && body.length > BODY_NOISE_THRESHOLD_BYTES) {
                  await markAutoRejected({
                    userId: payload.userId,
                    gmailMessageId: message.id,
                    gmailThreadId,
                    fromAddress,
                    subject,
                    contentHash,
                    reason: `body_too_large:${body.length}b`,
                  })
                  return { processed: true, createdJob: false }
                }

                // Content-hash dedupe (skip reprocessing identical emails unless forced).
                const { data: duplicateByContent } = await supabase
                  .from('processed_emails')
                  .select('gmail_message_id')
                  .eq('user_id', payload.userId)
                  .eq('content_hash', contentHash)
                  .neq('gmail_message_id', message.id)
                  .maybeSingle<{ gmail_message_id: string }>()

                if (duplicateByContent && !payload.force) {
                  await markAutoRejected({
                    userId: payload.userId,
                    gmailMessageId: message.id,
                    gmailThreadId,
                    fromAddress,
                    subject,
                    contentHash,
                    reason: 'duplicate_content',
                  })
                  return { processed: true, createdJob: false }
                }

                // Fast-skip — cheap regex layer with always-pass override.
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
                  })
                  return { processed: true, createdJob: false }
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
                  },
                  ...(payload.extractionMode ? { extractionMode: payload.extractionMode } : {}),
                }

                try {
                  await enqueueExtractionJob(extractionPayload)
                  // Job is queued — extraction happens async in the worker.
                  // We track real counts via processed_emails.review_status='auto_accepted'
                  // queried separately in the sync status API, not via this counter.
                  return { processed: true, createdJob: false }
                } catch (queueError) {
                  if (process.env.NODE_ENV !== 'production') {
                    console.warn(
                      'Extraction queue unavailable — processing inline (dev mode only)',
                      queueError
                    )
                    const pipelineResult = await processExtractionJob(extractionPayload)
                    const createdJob =
                      pipelineResult?.outcome === 'auto_accepted' &&
                      pipelineResult.upsertResult?.action === 'created'
                    return { processed: true, createdJob }
                  }
                  throw queueError
                }
              } catch (err) {
                console.error('Sync message processing failed:', err)
                return { processed: false, createdJob: false }
              }
            })
          )

          processedCount += results.filter((r) => r.processed).length
          newJobsFound += results.filter((r) => r.createdJob).length

          if (statusRow && (processedCount === totalEmails || processedCount % 5 === 0)) {
            await updateSyncStatus(statusRow.id, {
              processed_count: processedCount,
              new_jobs_found: newJobsFound,
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

    // Count jobs actually created (async workers may still be running,
    // so we query the source of truth directly).
    const { count: actualJobsCreated } = await supabase
      .from('processed_emails')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', payload.userId)
      .eq('review_status', 'auto_accepted')
      .gte('updated_at', syncStartedAt)

    if (statusRow && actualJobsCreated !== null && !isStopped) {
      await updateSyncStatus(statusRow.id, {
        new_jobs_found: actualJobsCreated,
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
    await releaseSyncLock(payload.userId)
  }
}

// Note: the full pipeline now lives in `@/lib/extraction/processExtractionJob`.
// Stage 1 classifier, Stage 2 extractor, Stage 3 verifier, and the fuzzy upsert
// have been unified there and are mode-driven via `getExtractionConfig()`.
// This sync worker is now a pure fetcher + fast-skip + dispatcher.
