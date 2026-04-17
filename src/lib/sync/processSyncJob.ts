import { getGmailMessage, listGmailMessages } from '@/lib/gmail/client'
import { parseJobSignal } from '@/lib/gmail/parser'
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

export async function processSyncJob(payload: SyncJobPayload) {
  const supabase = createServiceClient()
  const statusRow = await getLatestSyncStatusRow(payload.userId)

  try {
    const { data: tokenRow, error: tokenError } = await supabase
      .from('oauth_tokens')
      .select('access_token_encrypted,is_revoked')
      .eq('user_id', payload.userId)
      .eq('provider', 'google_gmail')
      .single<{
        access_token_encrypted: string
        is_revoked: boolean
      }>()

    if (tokenError || !tokenRow || tokenRow.is_revoked) {
      throw new Error('No active Gmail connection found for sync')
    }

    const accessToken = decryptSecret(tokenRow.access_token_encrypted)
    const listResponse = await listGmailMessages(accessToken)
    const messageRefs = listResponse.messages || []

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
      const signal = parseJobSignal({ from: fromAddress, subject })

      let createdJobId: string | null = null

      if (signal.company && signal.subject) {
        const { data: createdJob } = await supabase
          .from('jobs')
          .insert({
            user_id: payload.userId,
            title: signal.subject.slice(0, 180),
            company: signal.company,
            status: signal.inferredStatus || 'Applied',
            source: 'gmail_sync',
            notes: `Imported from Gmail message ${message.id}`,
            updated_at: new Date().toISOString(),
          })
          .select('id')
          .single<{ id: string }>()

        if (createdJob?.id) {
          createdJobId = createdJob.id
          newJobsFound += 1

          await supabase.from('job_emails').insert({
            job_id: createdJob.id,
            gmail_message_id: message.id,
            from_address: fromAddress || 'unknown',
            subject: subject || '(no subject)',
            snippet: message.snippet || null,
            received_at: message.internalDate
              ? new Date(Number(message.internalDate)).toISOString()
              : new Date().toISOString(),
            extracted_data: {
              company: signal.company,
              inferredStatus: signal.inferredStatus,
            },
          })

          await enqueueExtractionJob({
            userId: payload.userId,
            emailId: message.id,
            jobId: createdJob.id,
          })
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
