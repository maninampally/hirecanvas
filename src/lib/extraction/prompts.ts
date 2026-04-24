// Unified prompt definitions for the 3-stage AI pipeline.
// Stage 1 (classifier) and Stage 2 (extractor) should run on Gemini Flash.
// Stage 3 (verifier) MUST run on a different model family (Claude) to act as a cross-check.

export type ClassifierEmailType =
  | 'application_confirmation'
  | 'status_update'
  | 'interview_invite'
  | 'offer'
  | 'rejection'
  | 'recruiter_outreach'
  | 'not_job_related'

export type ExtractorStatus =
  | 'applied'
  | 'screening'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'closed'

export type ClassifierResult = {
  is_job_lifecycle: boolean
  email_type: ClassifierEmailType
  confidence: number
  reason: string
}

export type ExtractorResult = {
  company: string | null
  role: string | null
  status: ExtractorStatus | null
  status_evidence: string | null
  recruiter_name: string | null
  recruiter_email: string | null
  interview_date: string | null
  interview_type: 'phone' | 'video' | 'onsite' | 'technical' | 'assessment' | null
  location: string | null
  salary_range: string | null
  application_date: string | null
  ats_platform: string | null
  confidence: number
  low_confidence_fields: string[]
}

export type VerifierResult = {
  approved: boolean
  final_confidence: number
  company_verified: boolean
  role_verified: boolean
  status_verified: boolean
  rejection_reason: string | null
  corrected_company: string | null
  corrected_role: string | null
  corrected_status: ExtractorStatus | null
}

// ---------------------------------------------------------------------------
// STAGE 1 — CLASSIFIER
// ---------------------------------------------------------------------------

export const CLASSIFIER_SYSTEM_PROMPT = `You are a binary email classifier for a job application tracker.

Your ONLY job: determine if this email is a job application lifecycle email.

A job lifecycle email is one that:
- Confirms a job application was received by a company
- Updates the status of an application (screening, interview, offer, rejection)
- Invites the user to an interview or assessment
- Contains a job offer
- Rejects an application

NOT a job lifecycle email:
- Job alerts or job recommendations ("10 new jobs matching your profile")
- LinkedIn/Indeed/Glassdoor digest emails
- Newsletters about the job market
- Recruiter bulk outreach with no specific role context ("Are you open to opportunities?")
- Emails you sent yourself
- Receipts, invoices, password resets, marketing emails

You must respond with valid JSON only. No explanation. No markdown.`

export function buildClassifierPrompt(email: {
  from: string
  subject: string
  snippet: string
  bodyText: string
}) {
  return `Classify this email:

FROM: ${email.from}
SUBJECT: ${email.subject}
SNIPPET: ${email.snippet}
BODY (first 800 chars): ${(email.bodyText || '').slice(0, 800)}

Respond with exactly this JSON:
{
  "is_job_lifecycle": true or false,
  "email_type": one of "application_confirmation" | "status_update" | "interview_invite" | "offer" | "rejection" | "recruiter_outreach" | "not_job_related",
  "confidence": number from 0.0 to 1.0,
  "reason": "one sentence explaining your decision"
}

CLASSIFICATION RULES — follow exactly:
- If subject contains "thank you for applying" or "we received your application" or "application received" or "application submitted" or "application confirmation" → is_job_lifecycle: true, email_type: "application_confirmation", confidence >= 0.92
- If subject contains "update on your application" or "status of your application" or "application update" → is_job_lifecycle: true, email_type: "status_update", confidence >= 0.90
- If subject or body contains "interview" in the context of an invitation, schedule or confirmation → is_job_lifecycle: true, email_type: "interview_invite", confidence >= 0.88
- If subject or body contains "offer letter", "job offer", "we would like to offer", "offer of employment" → is_job_lifecycle: true, email_type: "offer", confidence >= 0.92
- If body contains "unfortunately", "not moving forward", "other candidates", "decided to move forward with other", "regret to inform" → is_job_lifecycle: true, email_type: "rejection", confidence >= 0.88
- If from address is a known ATS domain (myworkday, workday.com, greenhouse.io, lever.co, taleo, icims, smartrecruiters, ashbyhq, jobvite, bamboohr, recruitee, successfactors) → boost confidence by 0.10 and lean toward is_job_lifecycle=true
- If from address contains "careers@", "recruiting@", "talent@", "hiring@", or "@hr." with a non-portal domain → treat as likely application correspondence
- If subject contains "job alert", "jobs matching", "jobs for you", "recommended jobs", "new job" (as a listing announcement, not a real application), or is a daily/weekly digest → is_job_lifecycle: false, email_type: "not_job_related", confidence >= 0.90
- Recruiter cold outreach with no specific role the user applied to → is_job_lifecycle: false, email_type: "recruiter_outreach"
- When you are genuinely uncertain, return is_job_lifecycle: true with confidence 0.58-0.65. Do NOT inflate confidence beyond what the email evidence supports.
- Do NOT reject just because the company name is not visible in the first 800 chars — ATS emails sometimes put the company name in the body only.
- Outbound emails (sent by the user, not received) are NEVER job lifecycle emails — always return is_job_lifecycle: false for these.`
}

// ---------------------------------------------------------------------------
// STAGE 2 — EXTRACTOR
// ---------------------------------------------------------------------------

export const EXTRACTOR_SYSTEM_PROMPT = `You are a structured data extractor for a job application tracker.

Your job: extract specific fields from a job-related email with maximum accuracy.

Rules:
- If a field is not clearly stated in the email, return null — do not guess
- Company name: use the HIRING company name, not the ATS platform name
  (e.g. if email is from greenhouse.io on behalf of "Stripe", company = "Stripe")
- Role: extract the exact job title as written in the email
- Status: must reflect the CURRENT lifecycle stage based on email content
- Confidence: reflect your actual certainty — do not inflate
- You must respond with valid JSON only. No explanation. No markdown.`

export function buildExtractorPrompt(input: {
  from: string
  subject: string
  bodyText: string
  classifierResult: Pick<ClassifierResult, 'email_type' | 'confidence' | 'reason'>
}) {
  return `Extract structured job application data from this email.

The classifier already determined this is: ${input.classifierResult.email_type}
Classifier confidence: ${input.classifierResult.confidence}
Classifier reason: ${input.classifierResult.reason}

EMAIL:
FROM: ${input.from}
SUBJECT: ${input.subject}
BODY: ${(input.bodyText || '').slice(0, 2500)}

Respond with exactly this JSON:
{
  "company": "Hiring company name or null",
  "role": "Exact job title or null",
  "status": one of "applied" | "screening" | "interview" | "offer" | "rejected" | "closed" | null,
  "status_evidence": "Exact quote from email that determined this status",
  "recruiter_name": "Full name or null",
  "recruiter_email": "Email address or null",
  "interview_date": "ISO 8601 datetime or null",
  "interview_type": one of "phone" | "video" | "onsite" | "technical" | "assessment" | null,
  "location": "City State or Remote or null",
  "salary_range": "Salary string exactly as written or null",
  "application_date": "ISO 8601 date or null",
  "ats_platform": "ATS platform name (Greenhouse, Lever, Workday etc) or null",
  "confidence": number from 0.0 to 1.0,
  "low_confidence_fields": ["list any fields you are uncertain about"]
}

STATUS CLASSIFICATION — use these rules exactly:
- "applied": email confirms your application was received. Look for: "received your application", "thank you for applying", "application submitted"
- "screening": recruiter wants to chat OR online assessment sent. Look for: "phone screen", "quick call", "HireVue", "coding assessment", "take-home"
- "interview": structured interview scheduled or completed. Look for: "technical interview", "onsite", "panel interview", "meet the team", "interview on [date]"
- "offer": job offer extended. Look for: "offer letter", "we would like to offer", "compensation package", "start date", "congratulations"
- "rejected": application declined. Look for: "not moving forward", "other candidates", "position has been filled", "unfortunately", "decided not to"
- "closed": position cancelled or you withdrew. Look for: "position has been closed", "no longer accepting", "put on hold"

COMPANY EXTRACTION RULES:
- ATS emails often say "on behalf of [Company]" in the From field — extract that company
- If From is "no-reply@greenhouse.io", look in the body for the actual company name
- If the email says "Your application to [Company]" extract that company
- Never return "Greenhouse", "Lever", "Workday", "Taleo" as the company name — those are ATS platforms`
}

// ---------------------------------------------------------------------------
// STAGE 3 — VERIFIER
// ---------------------------------------------------------------------------

export const VERIFIER_SYSTEM_PROMPT = `You are a quality control judge for a job application data extraction system.

Your job: verify whether the extracted data accurately reflects what the email actually says.
You are the last gate before data enters the database.
Be skeptical. Reject if anything seems off.
You must respond with valid JSON only. No explanation. No markdown.`

export function buildVerifierPrompt(input: {
  email: { from: string; subject: string; bodyText: string }
  extraction: {
    company: string | null
    role: string | null
    status: string | null
    status_evidence: string | null
    confidence: number
  }
}) {
  return `Verify this job application extraction is accurate.

ORIGINAL EMAIL:
FROM: ${input.email.from}
SUBJECT: ${input.email.subject}
BODY: ${(input.email.bodyText || '').slice(0, 1500)}

EXTRACTED DATA:
Company: ${input.extraction.company}
Role: ${input.extraction.role}
Status: ${input.extraction.status}
Status evidence (quote from email): "${input.extraction.status_evidence}"
Extractor confidence: ${input.extraction.confidence}

VERIFY EACH FIELD:
1. Is the company name actually mentioned in the email? Or was it guessed?
2. Is the role title actually in the email? Or was it inferred?
3. Does the status_evidence quote actually appear in the email body?
4. Does the status accurately reflect what the email is communicating?
5. Is this definitely about a job application (not a generic marketing email)?

Respond with exactly this JSON:
{
  "approved": true or false,
  "final_confidence": number from 0.0 to 1.0,
  "company_verified": true or false,
  "role_verified": true or false,
  "status_verified": true or false,
  "rejection_reason": "If approved is false, explain exactly why in one sentence. Otherwise null.",
  "corrected_company": "If company was wrong, provide the correct value. Otherwise null.",
  "corrected_role": "If role was wrong, provide the correct value. Otherwise null.",
  "corrected_status": "If status was wrong, provide the correct value. Otherwise null."
}

REJECT (approved: false) if:
- The company name does not appear anywhere in the email text
- The status_evidence quote cannot be found in the email body
- The status contradicts what the email actually says
- The email is clearly not about a specific job application
- final_confidence would be below 0.70

APPROVE with corrections if:
- The data is mostly right but one field needs a small fix
- Use corrected_* fields to fix it rather than rejecting

APPROVE as-is if:
- All fields are clearly supported by the email content
- The extraction accurately represents what the email communicates`
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

const EMAIL_TYPES: ClassifierEmailType[] = [
  'application_confirmation',
  'status_update',
  'interview_invite',
  'offer',
  'rejection',
  'recruiter_outreach',
  'not_job_related',
]

const STATUS_VALUES: ExtractorStatus[] = [
  'applied',
  'screening',
  'interview',
  'offer',
  'rejected',
  'closed',
]

const INTERVIEW_TYPES = ['phone', 'video', 'onsite', 'technical', 'assessment'] as const

function coerceConfidence(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.min(1, value))
  if (typeof value === 'string') {
    const num = Number(value)
    if (Number.isFinite(num)) return Math.max(0, Math.min(1, num))
  }
  return 0
}

function stripJsonFence(raw: string) {
  const trimmed = raw.trim()
  if (trimmed.startsWith('```')) {
    return trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  }
  const match = trimmed.match(/\{[\s\S]*\}/)
  if (match) return match[0]
  return trimmed
}

export function parseClassifierResult(raw: string): ClassifierResult | null {
  try {
    const parsed = JSON.parse(stripJsonFence(raw)) as Record<string, unknown>
    const emailType = EMAIL_TYPES.includes(parsed.email_type as ClassifierEmailType)
      ? (parsed.email_type as ClassifierEmailType)
      : 'not_job_related'
    return {
      is_job_lifecycle: Boolean(parsed.is_job_lifecycle),
      email_type: emailType,
      confidence: coerceConfidence(parsed.confidence),
      reason: typeof parsed.reason === 'string' ? parsed.reason : '',
    }
  } catch {
    return null
  }
}

export function parseExtractorResult(raw: string): ExtractorResult | null {
  try {
    const parsed = JSON.parse(stripJsonFence(raw)) as Record<string, unknown>
    const status = STATUS_VALUES.includes(parsed.status as ExtractorStatus)
      ? (parsed.status as ExtractorStatus)
      : null
    const interviewType = INTERVIEW_TYPES.includes(parsed.interview_type as (typeof INTERVIEW_TYPES)[number])
      ? (parsed.interview_type as (typeof INTERVIEW_TYPES)[number])
      : null
    const toStr = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
    const lowConfRaw = parsed.low_confidence_fields
    const lowConf = Array.isArray(lowConfRaw)
      ? lowConfRaw.filter((v): v is string => typeof v === 'string')
      : []
    return {
      company: toStr(parsed.company),
      role: toStr(parsed.role),
      status,
      status_evidence: toStr(parsed.status_evidence),
      recruiter_name: toStr(parsed.recruiter_name),
      recruiter_email: toStr(parsed.recruiter_email),
      interview_date: toStr(parsed.interview_date),
      interview_type: interviewType,
      location: toStr(parsed.location),
      salary_range: toStr(parsed.salary_range),
      application_date: toStr(parsed.application_date),
      ats_platform: toStr(parsed.ats_platform),
      confidence: coerceConfidence(parsed.confidence),
      low_confidence_fields: lowConf,
    }
  } catch {
    return null
  }
}

export function parseVerifierResult(raw: string): VerifierResult | null {
  try {
    const parsed = JSON.parse(stripJsonFence(raw)) as Record<string, unknown>
    const correctedStatusRaw = parsed.corrected_status
    const correctedStatus = STATUS_VALUES.includes(correctedStatusRaw as ExtractorStatus)
      ? (correctedStatusRaw as ExtractorStatus)
      : null
    const toStr = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
    return {
      approved: Boolean(parsed.approved),
      final_confidence: coerceConfidence(parsed.final_confidence),
      company_verified: Boolean(parsed.company_verified),
      role_verified: Boolean(parsed.role_verified),
      status_verified: Boolean(parsed.status_verified),
      rejection_reason: toStr(parsed.rejection_reason),
      corrected_company: toStr(parsed.corrected_company),
      corrected_role: toStr(parsed.corrected_role),
      corrected_status: correctedStatus,
    }
  } catch {
    return null
  }
}
