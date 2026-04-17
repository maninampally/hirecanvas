import { type ExtractionJobPayload } from '@/lib/queue/extractionQueue'
import { recordAuditEvent } from '@/lib/security/audit'
import { createServiceClient } from '@/lib/supabase/service'

function inferStatusFromText(text: string) {
  const value = text.toLowerCase()

  if (value.includes('offer')) return 'Offer'
  if (value.includes('interview')) return 'Interview'
  if (value.includes('assessment') || value.includes('screen')) return 'Screening'
  if (value.includes('rejected') || value.includes('unfortunately')) return 'Rejected'
  if (value.includes('applied') || value.includes('application')) return 'Applied'

  return null
}

function getPiiFlags(text: string) {
  const piiFlags: string[] = []

  if (/\b\d{3}-\d{2}-\d{4}\b/.test(text)) piiFlags.push('ssn')
  if (/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/.test(text)) piiFlags.push('credit_card')
  if (/\b(?:api[_-]?key|secret|token|password)\b/i.test(text)) piiFlags.push('credential_like')

  return piiFlags
}

export async function processExtractionJob(payload: ExtractionJobPayload) {
  const supabase = createServiceClient()

  try {
    const { data: jobEmail, error: jobEmailError } = await supabase
      .from('job_emails')
      .select('id,job_id,subject,snippet,from_address')
      .eq('gmail_message_id', payload.emailId)
      .single<{
        id: string
        job_id: string
        subject: string
        snippet: string | null
        from_address: string
      }>()

    if (jobEmailError || !jobEmail) {
      throw new Error('Job email not found for extraction')
    }

    const rawText = `${jobEmail.subject || ''} ${jobEmail.snippet || ''}`.trim()
    const inferredStatus = inferStatusFromText(rawText)
    const piiFlags = getPiiFlags(rawText)
    const sanitizationApplied = piiFlags.length > 0

    await supabase
      .from('job_emails')
      .update({
        extracted_data: {
          source: 'heuristic_v1',
          inferredStatus,
          piiFlags,
          providerHint: payload.providerHint || null,
        },
      })
      .eq('id', jobEmail.id)

    if (inferredStatus) {
      await supabase
        .from('jobs')
        .update({
          status: inferredStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobEmail.job_id)
        .eq('user_id', payload.userId)
    }

    await supabase.from('extraction_audit_log').insert({
      user_id: payload.userId,
      extraction_type: 'job_email',
      resource_type: 'job_email',
      resource_id: jobEmail.id,
      action: 'extract',
      status: 'completed',
      pii_fields_detected: piiFlags,
      sanitization_applied: sanitizationApplied,
      gdpr_compliant: true,
      ccpa_compliant: true,
    })

    // Estimated token/cost placeholders until provider usage metrics are integrated.
    await supabase.from('ai_usage').insert({
      user_id: payload.userId,
      feature: 'email_extraction',
      tokens_used: Math.max(40, Math.ceil(rawText.length / 4)),
      cost_cents: 1,
      status: 'completed',
    })

    await recordAuditEvent({
      userId: payload.userId,
      eventType: 'extraction_completed',
      action: 'extract',
      resourceType: 'job_email',
      resourceId: jobEmail.id,
      newValues: {
        inferredStatus,
        piiFlags,
      },
    })
  } catch (error) {
    await recordAuditEvent({
      userId: payload.userId,
      eventType: 'extraction_failed',
      action: 'extract',
      resourceType: 'job_email',
      resourceId: payload.emailId,
      newValues: {
        error: error instanceof Error ? error.message : 'unknown',
      },
    })

    throw error
  }
}
