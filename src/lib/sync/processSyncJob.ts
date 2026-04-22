import { extractGmailMessageBody, getGmailMessage, listGmailMessageRefsForSync } from '@/lib/gmail/client'
import { inferEmailDirection, parseJobSignal } from '@/lib/gmail/parser'
import { getValidGmailAccessToken } from '@/lib/gmail/token'
import { enqueueExtractionJob } from '@/lib/queue/extractionQueue'
import { type SyncJobPayload } from '@/lib/queue/syncQueue'
import { recordAuditEvent } from '@/lib/security/audit'
import { decryptSecret } from '@/lib/security/encryption'
import { releaseSyncLock } from '@/lib/security/syncLock'
import { createServiceClient } from '@/lib/supabase/service'

type SyncStatusRow = {
  id: string
}

function getHeaderValue(
  headers: Array<{ name: string; value: string }> | undefined,
  name: string
) {
  return headers?.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value || ''
}

async function getLatestSyncStatusRow(userId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('sync_status')
    .select('id')
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

  try {
    const { accessToken, idTokenEncrypted } = await getValidGmailAccessToken(payload.userId)
    const userEmail = getEmailFromIdToken(idTokenEncrypted)
    const messageRefs = await listGmailMessageRefsForSync(accessToken)

    if (statusRow) {
      await updateSyncStatus(statusRow.id, {
        status: 'in_progress',
        total_emails: messageRefs.length,
        processed_count: 0,
        new_jobs_found: 0,
        error_message: null,
      })
    }

    let processedCount = 0
    let newJobsFound = 0

    for (const messageRef of messageRefs) {
      const { data: alreadyProcessed } = await supabase
        .from('processed_emails')
        .select('id')
        .eq('user_id', payload.userId)
        .eq('gmail_message_id', messageRef.id)
        .maybeSingle<{ id: string }>()

      if (alreadyProcessed) {
        processedCount += 1
        continue
      }

      const message = await getGmailMessage(accessToken, messageRef.id)
      const fromAddress = getHeaderValue(message.payload?.headers, 'From')
      const subject = getHeaderValue(message.payload?.headers, 'Subject')
      const body = extractGmailMessageBody(message)
      const receivedAtIso = message.internalDate
        ? new Date(Number(message.internalDate)).toISOString()
        : new Date().toISOString()
      const appliedDate = receivedAtIso.slice(0, 10)
      const signal = parseJobSignal({ from: fromAddress, subject })
      const emailDirection = inferEmailDirection({ from: fromAddress, userEmail })
      const inferredStatus = emailDirection === 'outbound' ? 'Applied' : signal.inferredStatus

      let createdJobId: string | null = null

      if (signal.company && signal.subject) {
        const { data: existingJob } = await supabase
          .from('jobs')
          .select('id,status')
          .eq('user_id', payload.userId)
          .ilike('company', signal.company)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle<{ id: string; status: string }>()

        if (existingJob?.id) {
          createdJobId = existingJob.id

          if (inferredStatus && existingJob.status !== inferredStatus) {
            await supabase
              .from('jobs')
              .update({
                status: inferredStatus,
                ai_confidence_score: 72,
                last_contacted_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingJob.id)
              .eq('user_id', payload.userId)

            await supabase.from('job_status_timeline').insert({
              job_id: existingJob.id,
              status: inferredStatus,
              changed_at: new Date().toISOString(),
              notes:
                emailDirection === 'outbound'
                  ? 'Marked Applied from outbound email'
                  : 'Auto-detected from inbound Gmail subject signal',
              ai_confidence_score: 72,
              requires_review: false,
            })
          }
        } else {
          const { data: createdJob } = await supabase
            .from('jobs')
            .insert({
              user_id: payload.userId,
              title: signal.subject.slice(0, 180),
              company: signal.company,
              status: inferredStatus || 'Applied',
              source: 'gmail_sync',
              notes: `Imported from Gmail message ${message.id}`,
              applied_date: appliedDate,
              updated_at: new Date().toISOString(),
            })
            .select('id')
            .single<{ id: string }>()

          if (createdJob?.id) {
            createdJobId = createdJob.id
            newJobsFound += 1
          }
        }

        if (createdJobId) {
          await supabase.from('job_emails').insert({
            job_id: createdJobId,
            gmail_message_id: message.id,
            from_address: fromAddress || 'unknown',
            email_direction: emailDirection,
            subject: subject || '(no subject)',
            snippet: message.snippet || null,
            body,
            received_at: receivedAtIso,
            extracted_data: {
              company: signal.company,
              inferredStatus,
              emailDirection,
            },
          })

          if (emailDirection !== 'outbound') {
            await enqueueExtractionJob({
              userId: payload.userId,
              emailId: message.id,
              jobId: createdJobId,
            })
          }
        }
      }

      await supabase.from('processed_emails').insert({
        user_id: payload.userId,
        gmail_message_id: message.id,
        from_address: fromAddress || 'unknown',
        subject: subject || null,
      })

      processedCount += 1

      if (statusRow && (processedCount === messageRefs.length || processedCount % 5 === 0)) {
        await updateSyncStatus(statusRow.id, {
          processed_count: processedCount,
          new_jobs_found: newJobsFound,
        })
      }

      void createdJobId
    }

    if (statusRow) {
      await updateSyncStatus(statusRow.id, {
        status: 'completed',
        processed_count: processedCount,
        new_jobs_found: newJobsFound,
        completed_at: new Date().toISOString(),
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
