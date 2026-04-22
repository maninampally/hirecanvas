import { runWithLLMRouter, type AIProvider } from '@/lib/ai/llmRouter'
import { sanitizeForAI } from '@/lib/ai/sanitizer'
import { getPythonATSKeywordDiff } from '@/lib/python/atsKeywordClient'

type ATSCheckerInput = {
  resumeText: string
  jobDescription: string
  resumeName?: string
  preferredProvider?: AIProvider
}

export type ATSCheckerResult = {
  score: number
  summary: string
  keywordMatches: string[]
  missingKeywords: string[]
  formattingSuggestions: string[]
  actionableSuggestions: string[]
  provider: string
  model: string
}

const STOPWORDS = new Set([
  'about',
  'after',
  'again',
  'against',
  'also',
  'among',
  'been',
  'being',
  'between',
  'could',
  'does',
  'from',
  'have',
  'into',
  'just',
  'more',
  'most',
  'only',
  'over',
  'same',
  'some',
  'such',
  'than',
  'that',
  'their',
  'there',
  'these',
  'they',
  'this',
  'very',
  'were',
  'what',
  'when',
  'where',
  'which',
  'will',
  'with',
  'your',
])

function tokenizeKeywords(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s+-]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !STOPWORDS.has(token))
}

function keywordDiffFallback(resumeText: string, jobDescription: string) {
  const resumeTokens = new Set(tokenizeKeywords(resumeText))
  const jobTokenFrequency = new Map<string, number>()

  for (const token of tokenizeKeywords(jobDescription)) {
    jobTokenFrequency.set(token, (jobTokenFrequency.get(token) || 0) + 1)
  }

  const sortedJobTokens = [...jobTokenFrequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([token]) => token)

  const matches: string[] = []
  const missing: string[] = []

  for (const token of sortedJobTokens) {
    if (resumeTokens.has(token)) {
      matches.push(token)
    } else {
      missing.push(token)
    }

    if (matches.length >= 12 && missing.length >= 12) {
      break
    }
  }

  return {
    keywordMatches: matches.slice(0, 10),
    missingKeywords: missing.slice(0, 10),
  }
}

async function keywordDiff(resumeText: string, jobDescription: string) {
  const pythonKeywords = await getPythonATSKeywordDiff(resumeText, jobDescription)

  if (pythonKeywords) {
    return {
      keywordMatches: pythonKeywords.keywordMatches,
      missingKeywords: pythonKeywords.missingKeywords,
    }
  }

  return keywordDiffFallback(resumeText, jobDescription)
}

function heuristicScore(matchCount: number, missingCount: number, resumeLength: number) {
  const keywordRatio = matchCount / Math.max(1, matchCount + missingCount)
  const structureBonus = resumeLength >= 800 ? 8 : resumeLength >= 500 ? 4 : 0
  const base = Math.round(45 + keywordRatio * 45 + structureBonus)
  return Math.max(0, Math.min(100, base))
}

export async function runATSChecker(input: ATSCheckerInput): Promise<ATSCheckerResult> {
  const resume = sanitizeForAI(input.resumeText)
  const job = sanitizeForAI(input.jobDescription)
  const keywordData = await keywordDiff(resume.sanitizedText, job.sanitizedText)

  const prompt = [
    'You are an ATS resume reviewer. Return strict JSON only.',
    'Required JSON keys: score, summary, keywordMatches, missingKeywords, formattingSuggestions, actionableSuggestions.',
    'Rules:',
    '- score must be integer 0-100',
    '- Keep each list to max 5 concise bullets',
    '- keywordMatches/missingKeywords should be lowercase terms',
    `Resume file: ${input.resumeName || 'Uploaded resume'}`,
    'Resume text:',
    resume.sanitizedText,
    'Job description:',
    job.sanitizedText,
  ].join('\n')

  const routed = await runWithLLMRouter({
    task: 'general',
    prompt,
    preferredProvider: input.preferredProvider,
    temperature: 0,
    maxTokens: 900,
  })

  const fallbackScore = heuristicScore(
    keywordData.keywordMatches.length,
    keywordData.missingKeywords.length,
    resume.sanitizedText.length
  )

  try {
    const parsed = JSON.parse(routed.text) as {
      score?: number
      summary?: string
      keywordMatches?: string[]
      missingKeywords?: string[]
      formattingSuggestions?: string[]
      actionableSuggestions?: string[]
    }

    return {
      score: Math.max(0, Math.min(100, Math.round(parsed.score ?? fallbackScore))),
      summary: parsed.summary || 'ATS analysis generated.',
      keywordMatches: (parsed.keywordMatches || keywordData.keywordMatches).slice(0, 5),
      missingKeywords: (parsed.missingKeywords || keywordData.missingKeywords).slice(0, 5),
      formattingSuggestions: (parsed.formattingSuggestions || [
        'Use a single-column layout for better ATS parsing.',
        'Avoid tables, text boxes, and image-only sections.',
      ]).slice(0, 5),
      actionableSuggestions: (parsed.actionableSuggestions || [
        'Align your summary with the top required skills in the role.',
        'Add measurable outcomes for recent experience bullets.',
      ]).slice(0, 5),
      provider: routed.provider,
      model: routed.model,
    }
  } catch {
    return {
      score: fallbackScore,
      summary: 'Fallback ATS analysis generated from keyword coverage.',
      keywordMatches: keywordData.keywordMatches,
      missingKeywords: keywordData.missingKeywords,
      formattingSuggestions: [
        'Use standard section headings like Summary, Experience, and Skills.',
        'Keep date formatting consistent across all roles.',
      ],
      actionableSuggestions: [
        'Add missing keywords from the job description naturally in relevant bullets.',
        'Include stronger action verbs and quantified impact where possible.',
      ],
      provider: routed.provider,
      model: routed.model,
    }
  }
}
