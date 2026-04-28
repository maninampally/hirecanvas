import { assertWithinDailyAIBudget } from '@/lib/ai/costGuard'
import { runWithLLMRouter } from '@/lib/ai/llmRouter'
import { sanitizeForAI } from '@/lib/ai/sanitizer'
import {
  type ExtractionEmailPayload,
  type ExtractionJobPayload,
} from '@/lib/queue/extractionQueue'
import { recordAuditEvent } from '@/lib/security/audit'
import { decryptOrReturnPlainText } from '@/lib/security/encryption'
import { createServiceClient } from '@/lib/supabase/service'
import { getExtractionConfig, type ExtractionConfig } from '@/lib/extraction/config'
import {
  CLASSIFIER_SYSTEM_PROMPT,
  EXTRACTOR_SYSTEM_PROMPT,
  VERIFIER_SYSTEM_PROMPT,
  buildClassifierPrompt,
  buildExtractorPrompt,
  buildVerifierPrompt,
  parseClassifierResult,
  parseExtractorResult,
  parseVerifierResult,
  type ClassifierResult,
  type ExtractorResult,
  type VerifierResult,
  type ExtractorStatus,
} from '@/lib/extraction/prompts'
import {
  flagForReview,
  markAutoAccepted,
  markAutoRejected,
  toAppStatus,
  upsertJobFromExtraction,
  type VerifiedExtraction,
} from '@/lib/extraction/upsert'

const MAX_EXTRACTION_TEXT_LENGTH = 2500

function cleanEmailText(raw: string) {
  return raw
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^>.*$/gm, '')
    .replace(/^On .+ wrote:$/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function getPiiFlags(text: string) {
  const piiFlags: string[] = []
  if (/\b\d{3}-\d{2}-\d{4}\b/.test(text)) piiFlags.push('ssn')
  if (/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/.test(text)) piiFlags.push('credit_card')
  if (/\b(?:api[_-]?key|secret|token|password)\b/i.test(text)) piiFlags.push('credential_like')
  return piiFlags
}

function toConfidenceScore(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const normalized = value <= 1 ? value * 100 : value
  return Math.max(0, Math.min(100, Math.round(normalized)))
}

function estimateCostCents(provider: string, inputTokens: number, outputTokens: number) {
  const rates = {
    gemini: { input: 0.00075, output: 0.003 },
    claude: { input: 0.003, output: 0.015 },
    openai: { input: 0.00015, output: 0.0006 },
  } as const
  if (!(provider in rates)) return 0
  const rate = rates[provider as keyof typeof rates]
  const raw = (inputTokens / 1000) * rate.input + (outputTokens / 1000) * rate.output
  // Use Math.ceil so sub-cent costs (e.g. $0.0003 from GPT-4o-mini) register as 1 cent
  // instead of rounding to 0 — which previously disabled the daily budget guard entirely.
  return raw > 0 ? Math.max(1, Math.ceil(raw)) : 0
}

type PipelineTrace = {
  stage1?: ClassifierResult | null
  stage2?: ExtractorResult | null
  stage3?: VerifierResult | null
  stage1Model?: string
  stage2Model?: string
  stage3Model?: string
  passCount: number
  inputTokens: number
  outputTokens: number
  costCents: number
}

// ---------------------------------------------------------------------------
// STAGE 1 — Relevance Classifier (OpenAI GPT-4o-mini preferred)
// ---------------------------------------------------------------------------

async function runStage1Classifier(email: ExtractionEmailPayload, trace: PipelineTrace) {
  const prompt = buildClassifierPrompt({
    from: email.from,
    subject: email.subject,
    snippet: email.snippet,
    bodyText: email.bodyText,
  })

  try {
    const result = await runWithLLMRouter({
      task: 'job_extraction',
      systemPrompt: CLASSIFIER_SYSTEM_PROMPT,
      prompt,
      preferredProvider: 'openai',
      strictPreferredProvider: false,
      temperature: 0,
      maxTokens: 1024, // gemini-2.5-flash uses thinking tokens that eat into output budget
    })
    trace.passCount += 1
    trace.inputTokens += result.usage?.inputTokens || 0
    trace.outputTokens += result.usage?.outputTokens || 0
    trace.costCents += estimateCostCents(
      result.provider,
      result.usage?.inputTokens || 0,
      result.usage?.outputTokens || 0
    )
    trace.stage1Model = `${result.provider}:${result.model}`

    // CRITICAL: if all LLM providers failed and we got regex_fallback,
    // throw retryable error so BullMQ retries instead of silently rejecting.
    // Must check BEFORE parsing — regex output parses as valid JSON but is wrong.
    if (result.provider === 'regex_fallback') {
      throw new Error(`All LLM providers failed for Stage 1 classification (${result.fallbackCount} failures)`)
    }

    const parsed = parseClassifierResult(result.text)
    if (parsed) {
      trace.stage1 = parsed
      return { parsed, providerFamily: result.provider as string }
    }
  } catch (err) {
    // If the error is retryable (provider failures, rate limits), re-throw
    // so BullMQ retries the job with exponential backoff.
    if (err instanceof Error && err.message.includes('All LLM providers failed')) {
      throw err
    }
    // For other errors (JSON parse failures etc.), fall through to safe fallback.
  }

  return {
    parsed: {
      is_job_lifecycle: false,
      email_type: 'not_job_related',
      confidence: 0.3,
      reason: 'classifier_fallback',
    } as ClassifierResult,
    providerFamily: 'regex_fallback',
  }
}

// ---------------------------------------------------------------------------
// STAGE 2 — Extractor (OpenAI GPT-4o-mini preferred)
// ---------------------------------------------------------------------------

async function runStage2Extractor(
  email: ExtractionEmailPayload,
  classifier: ClassifierResult,
  sanitizedBody: string,
  trace: PipelineTrace
) {
  const prompt = buildExtractorPrompt({
    from: email.from,
    subject: email.subject,
    bodyText: sanitizedBody,
    classifierResult: classifier,
  })

  try {
    const result = await runWithLLMRouter({
      task: 'job_extraction',
      systemPrompt: EXTRACTOR_SYSTEM_PROMPT,
      prompt,
      preferredProvider: 'openai',
      strictPreferredProvider: false,
      temperature: 0,
      maxTokens: 1024,
    })
    trace.passCount += 1
    trace.inputTokens += result.usage?.inputTokens || 0
    trace.outputTokens += result.usage?.outputTokens || 0
    trace.costCents += estimateCostCents(
      result.provider,
      result.usage?.inputTokens || 0,
      result.usage?.outputTokens || 0
    )
    trace.stage2Model = `${result.provider}:${result.model}`

    // If all providers failed, throw retryable error
    if (result.provider === 'regex_fallback') {
      throw new Error(`All LLM providers failed for Stage 2 extraction (${result.fallbackCount} failures)`)
    }

    const parsed = parseExtractorResult(result.text)
    if (parsed) {
      trace.stage2 = parsed
      return { parsed, providerFamily: result.provider as string }
    }
  } catch (err) {
    // Retryable: re-throw so BullMQ retries with backoff
    if (err instanceof Error && err.message.includes('All LLM providers failed')) {
      throw err
    }
    // For parse errors, fall through
  }

  return { parsed: null as ExtractorResult | null, providerFamily: 'regex_fallback' as string }
}

// ---------------------------------------------------------------------------
// STAGE 3 — Verifier (cross-check extraction quality)
// ---------------------------------------------------------------------------

async function runStage3Verifier(params: {
  email: ExtractionEmailPayload
  extraction: ExtractorResult
  sanitizedBody: string
  stage2ProviderFamily: string
  trace: PipelineTrace
}) {
  const { email, extraction, sanitizedBody, stage2ProviderFamily, trace } = params

  // Prefer a different model family than Stage 2 for independence.
  // But if that provider is unavailable, fall back to any working provider.
  // Priority: OpenAI > Claude > Gemini (if Stage 2 was Gemini)
  const preferredProvider: 'claude' | 'gemini' | 'openai' =
    stage2ProviderFamily === 'openai' ? 'claude'
    : stage2ProviderFamily === 'claude' ? 'openai'
    : 'openai'

  // BUG-002 mitigation: when Stage 2 ran on OpenAI and Anthropic credits
  // are exhausted, the router falls back to OpenAI for Stage 3 — same
  // family verifying its own output. Pin the verifier to a stronger model
  // (`gpt-4o` vs the extractor's `gpt-4o-mini`) so the cross-check still
  // catches a different distribution of mistakes.
  const verifierOpenAIModel = process.env.OPENAI_VERIFIER_MODEL || 'gpt-4o'
  const modelOverridePerProvider: Partial<Record<'gemini' | 'claude' | 'openai', string>> =
    stage2ProviderFamily === 'openai' ? { openai: verifierOpenAIModel } : {}

  const prompt = buildVerifierPrompt({
    email: { from: email.from, subject: email.subject, bodyText: sanitizedBody },
    extraction: {
      company: extraction.company,
      role: extraction.role,
      status: extraction.status,
      status_evidence: extraction.status_evidence,
      confidence: extraction.confidence,
    },
  })

  try {
    const result = await runWithLLMRouter({
      task: 'job_extraction',
      systemPrompt: VERIFIER_SYSTEM_PROMPT,
      prompt,
      preferredProvider,
      // Non-strict: fall back to any available provider rather than failing.
      strictPreferredProvider: false,
      temperature: 0,
      maxTokens: 1024,
      modelOverridePerProvider,
    })
    trace.passCount += 1
    trace.inputTokens += result.usage?.inputTokens || 0
    trace.outputTokens += result.usage?.outputTokens || 0
    trace.costCents += estimateCostCents(
      result.provider,
      result.usage?.inputTokens || 0,
      result.usage?.outputTokens || 0
    )
    trace.stage3Model = `${result.provider}:${result.model}`

    // If all providers failed and we got regex_fallback, skip parsing —
    // fall through to the auto-approve logic below instead of returning 0.00 confidence.
    if (result.provider !== 'regex_fallback') {
      const parsed = parseVerifierResult(result.text)
      if (parsed) {
        trace.stage3 = parsed
        return parsed
      }
    }
  } catch {
    // fall through — all verifier providers unavailable
  }

  // All verifier providers unavailable: auto-approve if Stage 2 had decent confidence.
  // This prevents provider outages from blocking all job creation.
  if (params.extraction.confidence >= 0.70) {
    return {
      approved: true,
      final_confidence: params.extraction.confidence * 0.90,
      company_verified: true,
      role_verified: true,
      status_verified: true,
      rejection_reason: null,
      corrected_company: null,
      corrected_role: null,
      corrected_status: null,
    } as VerifierResult
  }

  return {
    approved: false,
    final_confidence: 0.3,
    company_verified: false,
    role_verified: false,
    status_verified: false,
    rejection_reason: 'verifier_unavailable',
    corrected_company: null,
    corrected_role: null,
    corrected_status: null,
  } as VerifierResult
}

// ---------------------------------------------------------------------------
// Status-evidence proof check
// ---------------------------------------------------------------------------

function hasEvidenceInBody(evidence: string | null, bodyText: string) {
  if (!evidence) return false
  const normalizedBody = bodyText.toLowerCase().replace(/\s+/g, ' ')
  const normalizedEvidence = evidence.toLowerCase().replace(/\s+/g, ' ').trim()
  if (!normalizedEvidence) return false
  if (normalizedBody.includes(normalizedEvidence)) return true
  // Allow fragment matches — the model may quote a slice.
  const firstEight = normalizedEvidence.split(' ').slice(0, 8).join(' ')
  return firstEight.length > 10 && normalizedBody.includes(firstEight)
}

// ---------------------------------------------------------------------------
// Main pipeline — runs on raw email payload
// ---------------------------------------------------------------------------

export async function runExtractionPipeline(params: {
  userId: string
  email: ExtractionEmailPayload
  userTier: 'free' | 'pro' | 'elite' | 'admin'
  mode?: ExtractionConfig['mode']
}) {
  const supabase = createServiceClient()
  const { userId, email } = params
  const config = getExtractionConfig(params.mode)

  const rawText = cleanEmailText(
    [email.subject, email.snippet, email.bodyText].filter(Boolean).join('\n\n')
  )
    .slice(0, MAX_EXTRACTION_TEXT_LENGTH)
    .trim()

  const sanitized = sanitizeForAI(rawText)
  const piiFlags = sanitized.piiFlags.length > 0 ? sanitized.piiFlags : getPiiFlags(rawText)

  const trace: PipelineTrace = {
    passCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    costCents: 0,
  }

  // Stage 1 — classifier
  const stage1 = await runStage1Classifier(
    {
      ...email,
      bodyText: sanitized.sanitizedText,
    },
    trace
  )

  // Gate 1a — not lifecycle → auto reject
  if (!stage1.parsed.is_job_lifecycle) {
    await markAutoRejected({
      userId,
      gmailMessageId: email.gmailMessageId,
      fromAddress: email.from,
      subject: email.subject,
      contentHash: email.contentHash,
      receivedAt: email.receivedAtIso,
      reason: `stage1_rejected:${stage1.parsed.email_type}`,
    })
    await writeAiUsage(userId, params.userTier, trace)
    return { outcome: 'auto_rejected' as const, reason: 'not_job_lifecycle', trace }
  }

  // Gate 1b — email type not in allowedEmailTypes (filtered by mode)
  if (!config.allowedEmailTypes.includes(stage1.parsed.email_type)) {
    await markAutoRejected({
      userId,
      gmailMessageId: email.gmailMessageId,
      fromAddress: email.from,
      subject: email.subject,
      contentHash: email.contentHash,
      receivedAt: email.receivedAtIso,
      reason: `stage1_type_blocked:${stage1.parsed.email_type}`,
    })
    await writeAiUsage(userId, params.userTier, trace)
    return { outcome: 'auto_rejected' as const, reason: 'email_type_blocked', trace }
  }

  // Gate 1c — low confidence: either borderline (needs_review) or hard reject
  if (stage1.parsed.confidence < config.borderlineMin) {
    // If the model said IS a job email but confidence is very low,
    // flag for human review rather than auto-rejecting a potential real application.
    if (stage1.parsed.is_job_lifecycle) {
      await flagForReview({
        userId,
        gmailMessageId: email.gmailMessageId,
        fromAddress: email.from,
        subject: email.subject,
        contentHash: email.contentHash,
      receivedAt: email.receivedAtIso,
        reason: `stage1_lifecycle_but_low_confidence:${stage1.parsed.confidence.toFixed(2)}`,
        extraction: { stage1: stage1.parsed },
      })
      await writeAiUsage(userId, params.userTier, trace)
      return { outcome: 'needs_review' as const, reason: 'classifier_lifecycle_low_confidence', trace }
    }
    // Model said NOT a job email AND very low confidence — safe to reject.
    await markAutoRejected({
      userId,
      gmailMessageId: email.gmailMessageId,
      fromAddress: email.from,
      subject: email.subject,
      contentHash: email.contentHash,
      receivedAt: email.receivedAtIso,
      reason: `stage1_low_confidence:${stage1.parsed.confidence.toFixed(2)}`,
    })
    await writeAiUsage(userId, params.userTier, trace)
    return { outcome: 'auto_rejected' as const, reason: 'classifier_confidence_below_borderline', trace }
  }

  if (stage1.parsed.confidence < config.classifierConfidenceMin) {
    await flagForReview({
      userId,
      gmailMessageId: email.gmailMessageId,
      fromAddress: email.from,
      subject: email.subject,
      contentHash: email.contentHash,
      receivedAt: email.receivedAtIso,
      reason: `stage1_borderline:${stage1.parsed.confidence.toFixed(2)}`,
      extraction: { stage1: stage1.parsed },
    })
    await writeAiUsage(userId, params.userTier, trace)
    return { outcome: 'needs_review' as const, reason: 'classifier_borderline', trace }
  }

  // Stage 2 — extractor
  const stage2 = await runStage2Extractor(email, stage1.parsed, sanitized.sanitizedText, trace)

  if (!stage2.parsed) {
    await flagForReview({
      userId,
      gmailMessageId: email.gmailMessageId,
      fromAddress: email.from,
      subject: email.subject,
      contentHash: email.contentHash,
      receivedAt: email.receivedAtIso,
      reason: 'stage2_parse_failure',
      extraction: { stage1: stage1.parsed },
    })
    await writeAiUsage(userId, params.userTier, trace)
    return { outcome: 'needs_review' as const, reason: 'extractor_parse_failure', trace }
  }

  // Gate 2 — company/status presence + confidence + low_confidence_fields
  const extracted = stage2.parsed
  const missingCompany =
    config.requireCompany && !extracted.company && !extracted.ats_platform
  const missingStatus = config.requireStatus && !extracted.status
  const missingRole = config.requireRole && !extracted.role
  const lowConfFlags = new Set(extracted.low_confidence_fields.map((f) => f.toLowerCase()))
  const criticalFieldWeak =
    lowConfFlags.has('company') || lowConfFlags.has('status')

  if (
    missingCompany ||
    missingStatus ||
    missingRole ||
    extracted.confidence < config.extractorConfidenceMin ||
    criticalFieldWeak
  ) {
    await flagForReview({
      userId,
      gmailMessageId: email.gmailMessageId,
      fromAddress: email.from,
      subject: email.subject,
      contentHash: email.contentHash,
      receivedAt: email.receivedAtIso,
      reason: [
        missingCompany ? 'missing_company' : null,
        missingStatus ? 'missing_status' : null,
        missingRole ? 'missing_role' : null,
        criticalFieldWeak ? 'critical_field_low_confidence' : null,
        extracted.confidence < config.extractorConfidenceMin ? 'stage2_low_confidence' : null,
      ]
        .filter(Boolean)
        .join(','),
      extraction: { stage1: stage1.parsed, stage2: extracted },
    })
    await writeAiUsage(userId, params.userTier, trace)
    return { outcome: 'needs_review' as const, reason: 'extractor_gate_failed', trace }
  }

  // Stage 3 — verifier (cross-model)
  const stage3 = await runStage3Verifier({
    email,
    extraction: extracted,
    sanitizedBody: sanitized.sanitizedText,
    stage2ProviderFamily: stage2.providerFamily,
    trace,
  })

  // Gate 3a — status_evidence must actually appear in body
  if (extracted.status_evidence && !hasEvidenceInBody(extracted.status_evidence, sanitized.sanitizedText)) {
    await flagForReview({
      userId,
      gmailMessageId: email.gmailMessageId,
      fromAddress: email.from,
      subject: email.subject,
      contentHash: email.contentHash,
      receivedAt: email.receivedAtIso,
      reason: 'status_evidence_not_in_body',
      extraction: { stage1: stage1.parsed, stage2: extracted, stage3 },
    })
    await writeAiUsage(userId, params.userTier, trace)
    return { outcome: 'needs_review' as const, reason: 'status_evidence_not_in_body', trace }
  }

  // Gate 3b — verifier approval + final confidence
  if (!stage3.approved || stage3.final_confidence < config.verifierConfidenceMin) {
    await flagForReview({
      userId,
      gmailMessageId: email.gmailMessageId,
      fromAddress: email.from,
      subject: email.subject,
      contentHash: email.contentHash,
      receivedAt: email.receivedAtIso,
      reason: stage3.rejection_reason || `stage3_rejected:${stage3.final_confidence.toFixed(2)}`,
      extraction: { stage1: stage1.parsed, stage2: extracted, stage3 },
    })
    await writeAiUsage(userId, params.userTier, trace)
    return { outcome: 'needs_review' as const, reason: 'verifier_rejected', trace }
  }

  // Apply verifier corrections
  const finalCompany = stage3.corrected_company || extracted.company
  const finalRole = stage3.corrected_role || extracted.role
  const finalStatus: ExtractorStatus | null =
    stage3.corrected_status || extracted.status

  if (!finalCompany || !finalStatus) {
    await flagForReview({
      userId,
      gmailMessageId: email.gmailMessageId,
      fromAddress: email.from,
      subject: email.subject,
      contentHash: email.contentHash,
      receivedAt: email.receivedAtIso,
      reason: 'post_correction_missing_required_fields',
      extraction: { stage1: stage1.parsed, stage2: extracted, stage3 },
    })
    await writeAiUsage(userId, params.userTier, trace)
    return { outcome: 'needs_review' as const, reason: 'post_correction_missing', trace }
  }

  const appStatus = toAppStatus(finalStatus)
  if (!appStatus) {
    await flagForReview({
      userId,
      gmailMessageId: email.gmailMessageId,
      fromAddress: email.from,
      subject: email.subject,
      contentHash: email.contentHash,
      receivedAt: email.receivedAtIso,
      reason: `unmapped_status:${finalStatus}`,
      extraction: { stage1: stage1.parsed, stage2: extracted, stage3 },
    })
    await writeAiUsage(userId, params.userTier, trace)
    return { outcome: 'needs_review' as const, reason: 'unmapped_status', trace }
  }

  const verified: VerifiedExtraction = {
    company: finalCompany,
    role: finalRole,
    status: appStatus,
    recruiter_name: extracted.recruiter_name,
    recruiter_email: extracted.recruiter_email,
    interview_date: extracted.interview_date,
    interview_type: extracted.interview_type,
    location: extracted.location,
    salary_range: extracted.salary_range,
    application_date: extracted.application_date,
    ats_platform: extracted.ats_platform,
    ai_confidence_score: toConfidenceScore(stage3.final_confidence),
  }

  const upsertResult = await upsertJobFromExtraction({
    userId,
    extraction: verified,
    email: {
      gmailMessageId: email.gmailMessageId,
      from: email.from,
      subject: email.subject,
      receivedAtIso: email.receivedAtIso,
      snippet: email.snippet,
      emailDirection: email.emailDirection,
    },
    body: email.bodyText,
  })

  await markAutoAccepted({
    userId,
    gmailMessageId: email.gmailMessageId,
    fromAddress: email.from,
    subject: email.subject,
    contentHash: email.contentHash,
    reason: `${upsertResult.action}:${appStatus}`,
    extraction: {
      stage1: stage1.parsed,
      stage2: extracted,
      stage3,
      verified,
      upsertResult,
    },
  })

  if (upsertResult.statusChanged) {
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'status_change_detected',
      title: `${verified.company}: ${upsertResult.newStatus}`,
      message: `Auto-detected status ${upsertResult.previousStatus || 'new'} → ${upsertResult.newStatus} for ${verified.company}.`,
      action_url: `/applications/${upsertResult.jobId}`,
    })
  }

  await supabase.from('extraction_audit_log').insert({
    user_id: userId,
    extraction_type: 'job_email',
    resource_type: 'job_email',
    resource_id: upsertResult.jobId,
    action: 'extract',
    status: 'completed',
    pii_fields_detected: piiFlags,
    sanitization_applied: piiFlags.length > 0,
    gdpr_compliant: true,
    ccpa_compliant: true,
  })

  await writeAiUsage(userId, params.userTier, trace)

  return {
    outcome: 'auto_accepted' as const,
    upsertResult,
    verified,
    trace,
  }
}

async function writeAiUsage(
  userId: string,
  tier: 'free' | 'pro' | 'elite' | 'admin',
  trace: PipelineTrace
) {
  const supabase = createServiceClient()
  const totalTokens = trace.inputTokens + trace.outputTokens
  if (totalTokens === 0 && trace.costCents === 0) return
  try {
    await supabase.from('ai_usage').insert({
      user_id: userId,
      feature: 'email_extraction',
      tokens_used: Math.max(1, totalTokens),
      cost_cents: trace.costCents,
      tier,
      status: 'completed',
    })
  } catch {
    // Best-effort analytics; never block the pipeline.
  }
}

// ---------------------------------------------------------------------------
// BullMQ entry point
// ---------------------------------------------------------------------------

export async function processExtractionJob(payload: ExtractionJobPayload) {
  const supabase = createServiceClient()

  const { data: appUser } = await supabase
    .from('app_users')
    .select('tier')
    .eq('id', payload.userId)
    .maybeSingle<{ tier: 'free' | 'pro' | 'elite' | 'admin' }>()
  const userTier = appUser?.tier || 'free'

  try {
    await assertWithinDailyAIBudget(payload.userId, userTier)

    // Preferred path: full payload provided by the new sync pipeline.
    if (payload.email) {
      return await runExtractionPipeline({
        userId: payload.userId,
        email: payload.email,
        userTier,
        mode: payload.extractionMode,
      })
    }

    // Back-compat: hydrate from existing job_emails row.
    if (payload.emailId) {
      const { data: jobEmail } = await supabase
        .from('job_emails')
        .select('id,job_id,subject,snippet,body,from_address,received_at')
        .eq('gmail_message_id', payload.emailId)
        .single<{
          id: string
          job_id: string
          subject: string
          snippet: string | null
          body: string | null
          from_address: string
          received_at: string
        }>()

      if (!jobEmail) {
        throw new Error('Legacy extraction: job_email not found')
      }

      const bodyText = decryptOrReturnPlainText(jobEmail.body) || ''
      const email: ExtractionEmailPayload = {
        gmailMessageId: payload.emailId,
        from: jobEmail.from_address,
        subject: jobEmail.subject,
        snippet: jobEmail.snippet || '',
        bodyText,
        receivedAtIso: jobEmail.received_at,
        contentHash: null,
        emailDirection: 'inbound',
      }
      return await runExtractionPipeline({
        userId: payload.userId,
        email,
        userTier,
        mode: payload.extractionMode,
      })
    }

    throw new Error('Extraction payload missing both email and emailId')
  } catch (error) {
    await recordAuditEvent({
      userId: payload.userId,
      eventType: 'extraction_failed',
      action: 'extract',
      resourceType: 'job_email',
      resourceId: payload.email?.gmailMessageId || payload.emailId,
      newValues: {
        error: error instanceof Error ? error.message : 'unknown',
      },
    })
    throw error
  }
}
