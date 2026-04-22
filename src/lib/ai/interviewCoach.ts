import { runWithLLMRouter, type AIProvider } from '@/lib/ai/llmRouter'
import { sanitizeForAI } from '@/lib/ai/sanitizer'

export type InterviewCoachInput = {
  question: string
  userAnswer: string
  sampleAnswer?: string | null
  preferredProvider?: AIProvider
}

export type InterviewCoachResult = {
  score: number
  summary: string
  strengths: string[]
  improvements: string[]
  followUpQuestions: string[]
  provider: string
  model: string
}

export async function getInterviewCoaching(input: InterviewCoachInput): Promise<InterviewCoachResult> {
  const sanitizedQuestion = sanitizeForAI(input.question)
  const sanitizedAnswer = sanitizeForAI(input.userAnswer)
  const sanitizedSample = sanitizeForAI(input.sampleAnswer || '')

  const prompt = [
    'Evaluate the interview answer and return strict JSON.',
    'Required JSON keys: score, summary, strengths, improvements, followUpQuestions.',
    'Rules: score must be integer 0-100, strengths/improvements/followUpQuestions each max 3 items.',
    'Question:',
    sanitizedQuestion.sanitizedText,
    'Candidate answer:',
    sanitizedAnswer.sanitizedText,
    `Reference sample answer: ${sanitizedSample.sanitizedText || 'Not available'}`,
  ].join('\n')

  const routed = await runWithLLMRouter({
    task: 'general',
    prompt,
    preferredProvider: input.preferredProvider,
    temperature: 0,
    maxTokens: 700,
  })

  try {
    const parsed = JSON.parse(routed.text) as {
      score?: number
      summary?: string
      strengths?: string[]
      improvements?: string[]
      followUpQuestions?: string[]
    }

    return {
      score: Math.max(0, Math.min(100, Math.round(parsed.score ?? 0))),
      summary: parsed.summary || 'Feedback generated.',
      strengths: (parsed.strengths || []).slice(0, 3),
      improvements: (parsed.improvements || []).slice(0, 3),
      followUpQuestions: (parsed.followUpQuestions || []).slice(0, 3),
      provider: routed.provider,
      model: routed.model,
    }
  } catch {
    return {
      score: 60,
      summary: 'AI feedback fallback used. Refine your answer with clearer structure and measurable outcomes.',
      strengths: ['You attempted a complete response.'],
      improvements: ['Use STAR format', 'Add concrete metrics', 'Be more concise'],
      followUpQuestions: ['What was the measurable impact?', 'What would you improve next time?'],
      provider: routed.provider,
      model: routed.model,
    }
  }
}
