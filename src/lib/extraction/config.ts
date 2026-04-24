export type ExtractionMode = 'balanced' | 'high_precision' | 'high_recall'

export interface ExtractionConfig {
  mode: ExtractionMode
  classifierConfidenceMin: number
  extractorConfidenceMin: number
  verifierConfidenceMin: number
  requireCompany: boolean
  requireRole: boolean
  requireStatus: boolean
  // Emails between borderlineMin and classifierConfidenceMin are flagged as needs_review.
  borderlineMin: number
  fastSkipAggressive: boolean
  allowedEmailTypes: string[]
}

export const EXTRACTION_CONFIGS: Record<ExtractionMode, ExtractionConfig> = {
  balanced: {
    mode: 'balanced',
    classifierConfidenceMin: 0.68,
    extractorConfidenceMin: 0.72,
    verifierConfidenceMin: 0.7,
    requireCompany: true,
    requireRole: false,
    requireStatus: true,
    borderlineMin: 0.55,
    fastSkipAggressive: false,
    allowedEmailTypes: [
      'application_confirmation',
      'status_update',
      'interview_invite',
      'offer',
      'rejection',
      'recruiter_outreach',
    ],
  },

  high_precision: {
    mode: 'high_precision',
    classifierConfidenceMin: 0.85,
    extractorConfidenceMin: 0.85,
    verifierConfidenceMin: 0.82,
    requireCompany: true,
    requireRole: true,
    requireStatus: true,
    borderlineMin: 0.7,
    fastSkipAggressive: true,
    allowedEmailTypes: [
      'application_confirmation',
      'interview_invite',
      'offer',
      'rejection',
    ],
  },

  high_recall: {
    mode: 'high_recall',
    classifierConfidenceMin: 0.58,
    extractorConfidenceMin: 0.62,
    verifierConfidenceMin: 0.6,
    requireCompany: true,
    requireRole: false,
    requireStatus: false,
    borderlineMin: 0.45,
    fastSkipAggressive: false,
    allowedEmailTypes: [
      'application_confirmation',
      'status_update',
      'interview_invite',
      'offer',
      'rejection',
      'recruiter_outreach',
      'unknown',
    ],
  },
}

function resolveModeFromEnv(): ExtractionMode {
  const raw = (process.env.EXTRACTION_MODE || '').trim().toLowerCase()
  if (raw === 'balanced' || raw === 'high_precision' || raw === 'high_recall') {
    return raw
  }
  return 'balanced'
}

export function getExtractionConfig(mode?: ExtractionMode): ExtractionConfig {
  const resolved = mode || resolveModeFromEnv()
  return EXTRACTION_CONFIGS[resolved]
}
