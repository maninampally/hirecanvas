import { runWithLLMRouter } from './llmRouter'

export type TailoredResumeResult = {
  tailoredText: string
  changesMade: string[]
  matchExplanation: string
}

const TAILOR_SYSTEM_PROMPT = `You are an expert Executive Resume Writer and ATS Optimization specialist.
Your goal is to rewrite a candidate's resume to perfectly align with a specific job description.

RULES:
1. DO NOT fabricate experience. Only use facts provided in the original resume.
2. Optimize for ATS by incorporating relevant keywords from the job description naturally.
3. Use strong action verbs and quantifiable achievements.
4. Maintain a professional, clean tone.
5. Return the result in a structured format with the tailored text and a summary of changes.
6. The output must be valid Markdown.`

export async function tailorResume(params: {
  resumeText: string
  jobDescription: string
  additionalInstructions?: string
}): Promise<TailoredResumeResult> {
  const prompt = `
JOB DESCRIPTION:
${params.jobDescription}

ORIGINAL RESUME:
${params.resumeText}

${params.additionalInstructions ? `ADDITIONAL INSTRUCTIONS: ${params.additionalInstructions}` : ''}

TASK:
1. Rewrite the resume to better match the job description.
2. Focus on the Summary, Skills, and Experience sections.
3. Ensure keywords from the JD are present in the resume.
4. Keep the structure similar to the original.

RESPONSE FORMAT (JSON):
{
  "tailoredText": "full tailored resume in markdown...",
  "changesMade": ["list of key changes...", "..."],
  "matchExplanation": "brief explanation of why this version is a better match"
}
`

  const result = await runWithLLMRouter({
    task: 'resume_tailoring',
    systemPrompt: TAILOR_SYSTEM_PROMPT,
    prompt,
    temperature: 0.3,
    maxTokens: 4000,
  })

  try {
    // Attempt to extract JSON from the response
    const jsonMatch = result.text.match(/\{[\s\S]*\}/)
    const data = JSON.parse(jsonMatch ? jsonMatch[0] : result.text)
    return {
      tailoredText: data.tailoredText || '',
      changesMade: data.changesMade || [],
      matchExplanation: data.matchExplanation || '',
    }
  } catch (error) {
    // Fallback if AI doesn't return clean JSON
    return {
      tailoredText: result.text,
      changesMade: ['Resume rewritten for better ATS alignment'],
      matchExplanation: 'Tailored to incorporate job-specific keywords.',
    }
  }
}
