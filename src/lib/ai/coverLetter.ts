import { runWithLLMRouter, type AIProvider, type LLMRouterResult } from '@/lib/ai/llmRouter'
import { sanitizeForAI } from '@/lib/ai/sanitizer'

export type CoverLetterInput = {
  resumeName: string
  resumeSummary?: string
  jobTitle: string
  company: string
  jobDescription: string
  tone: 'professional' | 'conversational' | 'creative'
  preferredProvider?: AIProvider
}

export type CoverLetterResult = {
  letter: string
  provider: LLMRouterResult['provider']
  model: string
  fallbackCount: number
}

export async function generateCoverLetter(input: CoverLetterInput): Promise<CoverLetterResult> {
  const sanitizedJob = sanitizeForAI(input.jobDescription)
  const sanitizedResume = sanitizeForAI(input.resumeSummary || '')

  const prompt = [
    `Write a ${input.tone} cover letter in plain text.`,
    `Target role: ${input.jobTitle}`,
    `Company: ${input.company}`,
    `Resume filename: ${input.resumeName}`,
    `Resume summary: ${sanitizedResume.sanitizedText || 'Not provided'}`,
    'Job description:',
    sanitizedJob.sanitizedText,
    'Constraints:',
    '- Max 300 words',
    '- Clear opening, 2 compact body paragraphs, concise closing',
    '- Avoid placeholders like [Your Name]',
  ].join('\n')

  const result = await runWithLLMRouter({
    task: 'general',
    prompt,
    preferredProvider: input.preferredProvider,
    temperature: 0.2,
    maxTokens: 900,
  })

  return {
    letter: result.text,
    provider: result.provider,
    model: result.model,
    fallbackCount: result.fallbackCount,
  }
}
