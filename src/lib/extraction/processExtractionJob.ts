import { runWithLLMRouter } from '@/lib/ai/llmRouter'
import { sanitizeForAI } from '@/lib/ai/sanitizer'
import { type ExtractionJobPayload } from '@/lib/queue/extractionQueue'
import { recordAuditEvent } from '@/lib/security/audit'
import { createServiceClient } from '@/lib/supabase/service'

const MAX_EXTRACTION_TEXT_LENGTH = 12000

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

type ExtractedPayload = {
  company?: string | null
  role?: string | null
  salaryMin?: number | null
  salaryMax?: number | null
  currency?: string | null
  status?: 'Wishlist' | 'Applied' | 'Screening' | 'Interview' | 'Offer' | 'Rejected' | null
  confidence?: number | null
  notes?: string | null
}

type ExtractionRunResult = {
  provider: 'gemini' | 'claude' | 'openai' | 'regex_fallback'
  model: string
  text: string
  fallbackCount: number
  usage?: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
}

function toNumberOrNull(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function toConfidenceScore(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null

  const normalized = value <= 1 ? value * 100 : value
  return Math.max(0, Math.min(100, Math.round(normalized)))
}

function estimateCostCents(provider: string, inputTokens: number, outputTokens: number) {
  // Lightweight estimate for usage analytics. Values are approximate cents per 1K tokens.
  const ratesPer1k = {
    gemini: { input: 0.00075, output: 0.003 },
    claude: { input: 0.003, output: 0.015 },
    openai: { input: 0.00015, output: 0.0006 },
  } as const

  if (!(provider in ratesPer1k)) return 0
  const rate = ratesPer1k[provider as keyof typeof ratesPer1k]
  const rawCents = (inputTokens / 1000) * rate.input + (outputTokens / 1000) * rate.output
  return Math.max(0, Math.round(rawCents))
}

function parseExtractedPayload(text: string): ExtractedPayload | null {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>
    const status = typeof parsed.status === 'string' ? parsed.status : null

    const normalizedStatus =
      status &&
      ['Wishlist', 'Applied', 'Screening', 'Interview', 'Offer', 'Rejected'].includes(status)
        ? (status as ExtractedPayload['status'])
        : null

    return {
      company: typeof parsed.company === 'string' ? parsed.company : null,
      role: typeof parsed.role === 'string' ? parsed.role : null,
      salaryMin: toNumberOrNull(parsed.salaryMin),
      salaryMax: toNumberOrNull(parsed.salaryMax),
      currency: typeof parsed.currency === 'string' ? parsed.currency : null,
      status: normalizedStatus,
      confidence: toNumberOrNull(parsed.confidence),
      notes: typeof parsed.notes === 'string' ? parsed.notes : null,
    }
  } catch {
    return null
  }
}

function shouldEscalateExtraction(parsed: ExtractedPayload | null, heuristicStatus: string | null) {
  if (!parsed) return true

  const confidenceScore = toConfidenceScore(parsed.confidence)
  const hasStructuredSignal = Boolean(parsed.status || parsed.company || parsed.role || heuristicStatus)
  if (!hasStructuredSignal) return true

  return confidenceScore !== null && confidenceScore < 70
}

async function runAdaptiveExtractionModel(params: {
  userTier: 'free' | 'pro' | 'elite' | 'admin'
  prompt: string
  existingCompany?: string | null
  existingRole?: string | null
  heuristicStatus: string | null
}) {
  const { userTier, prompt, existingCompany, existingRole, heuristicStatus } = params
  const runs: ExtractionRunResult[] = []

  if (userTier === 'free') {
    const freeResult: ExtractionRunResult = {
      provider: 'regex_fallback',
      model: 'regex-v1',
      text: JSON.stringify({
        company: existingCompany || null,
        role: existingRole || null,
        status: heuristicStatus,
        confidence: 0.2,
        notes: 'Free tier uses regex extraction.',
      }),
      fallbackCount: 0,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    }
    return { chosen: freeResult, parsed: parseExtractedPayload(freeResult.text), runs }
  }

  // Pass 1: low-cost extraction (Gemini) with strict output constraints.
  const passOne = await runWithLLMRouter({
    task: 'job_extraction',
    systemPrompt:
      'You are a strict extraction engine. Return compact JSON only. No markdown, no prose.',
    prompt,
    preferredProvider: 'gemini',
    strictPreferredProvider: true,
    temperature: 0,
    maxTokens: 220,
  })
  runs.push(passOne)

  const parsedOne = parseExtractedPayload(passOne.text)
  if (!shouldEscalateExtraction(parsedOne, heuristicStatus)) {
    return { chosen: passOne, parsed: parsedOne, runs }
  }

  // Pass 2: accuracy-oriented rescue pass only when pass 1 is weak.
  const passTwoPreferred = userTier === 'pro' ? 'openai' : 'claude'
  const passTwo = await runWithLLMRouter({
    task: 'job_extraction',
    systemPrompt:
      'You are a high-precision extraction engine. Return valid compact JSON only. If uncertain, use null and explain briefly in notes.',
    prompt,
    preferredProvider: passTwoPreferred,
    strictPreferredProvider: false,
    temperature: 0,
    maxTokens: 420,
  })
  runs.push(passTwo)

  return { chosen: passTwo, parsed: parseExtractedPayload(passTwo.text), runs }
}

export async function processExtractionJob(payload: ExtractionJobPayload) {
  const supabase = createServiceClient()

  try {
    const { data: jobEmail, error: jobEmailError } = await supabase
      .from('job_emails')
      .select('id,job_id,subject,snippet,body,from_address')
      .eq('gmail_message_id', payload.emailId)
      .single<{
        id: string
        job_id: string
        subject: string
        snippet: string | null
        body: string | null
        from_address: string
      }>()

    if (jobEmailError || !jobEmail) {
      throw new Error('Job email not found for extraction')
    }

    const { data: existingJob } = await supabase
      .from('jobs')
      .select('id,status,title,company,ai_confidence_score')
      .eq('id', jobEmail.job_id)
      .eq('user_id', payload.userId)
      .maybeSingle<{
        id: string
        status: 'Wishlist' | 'Applied' | 'Screening' | 'Interview' | 'Offer' | 'Rejected'
        title: string
        company: string
        ai_confidence_score: number | null
      }>()

    const { data: appUser } = await supabase
      .from('app_users')
      .select('tier')
      .eq('id', payload.userId)
      .maybeSingle<{ tier: 'free' | 'pro' | 'elite' | 'admin' }>()

    const userTier = appUser?.tier || 'free'

    const rawText = [jobEmail.subject || '', jobEmail.snippet || '', jobEmail.body || '']
      .filter(Boolean)
      .join('\n\n')
      .slice(0, MAX_EXTRACTION_TEXT_LENGTH)
      .trim()
    const heuristicStatus = inferStatusFromText(rawText)

    const sanitized = sanitizeForAI(rawText)
    const piiFlags = sanitized.piiFlags.length > 0 ? sanitized.piiFlags : getPiiFlags(rawText)
    const sanitizationApplied = piiFlags.length > 0

    const extractionPrompt = [
      'Extract structured job application data from this email text.',
      'Return JSON only with keys: company, role, salaryMin, salaryMax, currency, status, confidence, notes.',
      'status must be one of: Wishlist, Applied, Screening, Interview, Offer, Rejected.',
      'If unknown, return null for the field.',
      '',
      sanitized.sanitizedText,
    ].join('\n')

    const extractionResult = await runAdaptiveExtractionModel({
      userTier,
      prompt: extractionPrompt,
      existingCompany: existingJob?.company,
      existingRole: existingJob?.title,
      heuristicStatus,
    })

    const aiResult = extractionResult.chosen
    const extracted = extractionResult.parsed
    const inferredStatus = extracted?.status || heuristicStatus
    const confidenceScore =
      toConfidenceScore(extracted?.confidence) || (heuristicStatus && !extracted?.status ? 65 : null)

    await supabase
      .from('job_emails')
      .update({
        extracted_data: {
          source: aiResult.provider === 'regex_fallback' ? 'regex_fallback' : 'llm_router_v1',
          inferredStatus,
          piiFlags,
          providerHint: aiResult.provider,
          model: aiResult.model,
          fallbackCount: aiResult.fallbackCount,
          passCount: extractionResult.runs.length,
          attempts: extractionResult.runs.map((run) => ({
            provider: run.provider,
            model: run.model,
            fallbackCount: run.fallbackCount,
            usage: run.usage || null,
          })),
          extracted,
        },
      })
      .eq('id', jobEmail.id)

    const jobPatch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (inferredStatus) jobPatch.status = inferredStatus
    if (extracted?.company) jobPatch.company = extracted.company
    if (extracted?.role) jobPatch.title = extracted.role
    if (typeof extracted?.salaryMin === 'number') jobPatch.salary_min = extracted.salaryMin
    if (typeof extracted?.salaryMax === 'number') jobPatch.salary_max = extracted.salaryMax
    if (extracted?.currency) jobPatch.currency = extracted.currency
    if (typeof confidenceScore === 'number') {
      jobPatch.ai_confidence_score = confidenceScore
    }

    await supabase
      .from('jobs')
      .update(jobPatch)
      .eq('id', jobEmail.job_id)
      .eq('user_id', payload.userId)

    if (inferredStatus && existingJob && existingJob.status !== inferredStatus) {
      const requiresReview = !confidenceScore || confidenceScore < 70

      await supabase.from('job_status_timeline').insert({
        job_id: existingJob.id,
        status: inferredStatus,
        changed_at: new Date().toISOString(),
        notes: `Auto-detected from synced email (${aiResult.provider})`,
        ai_confidence_score: confidenceScore,
        requires_review: requiresReview,
      })

      if (requiresReview) {
        await supabase.from('notifications').insert({
          user_id: payload.userId,
          type: 'status_review_required',
          title: 'Review an auto-detected status change',
          message: `${existingJob.title} at ${existingJob.company} was set to ${inferredStatus} with low confidence (${confidenceScore || 0}%).`,
          action_url: '/jobs',
        })
      }
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

    const summedTotalUsage = extractionResult.runs.reduce(
      (sum, run) => sum + (run.usage?.totalTokens || 0),
      0
    )
    const usageTotalTokens =
      summedTotalUsage > 0
        ? summedTotalUsage
        : Math.max(40, Math.ceil(rawText.length / 4))
    const estimatedCostCents = extractionResult.runs.reduce(
      (sum, run) =>
        sum +
        estimateCostCents(run.provider, run.usage?.inputTokens || 0, run.usage?.outputTokens || 0),
      0
    )

    await supabase.from('ai_usage').insert({
      user_id: payload.userId,
      feature: 'email_extraction',
      tokens_used: usageTotalTokens,
      cost_cents: estimatedCostCents,
      tier: userTier,
      status: 'completed'
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
        provider: aiResult.provider,
        model: aiResult.model,
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
