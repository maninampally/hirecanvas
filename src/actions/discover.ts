'use server'

import { createClient } from '@/lib/supabase/server'
import { runWithLLMRouter } from '@/lib/ai/llmRouter'
import { searchDiceJobs } from '@/lib/mcp/diceClient'

export type SuggestedJob = {
  id: string
  company: string
  title: string
  location: string
  salary?: string
  description: string
  matchScore: number
  matchReason: string
  source: 'dice' | 'linkedin' | 'internal'
  url: string
}

export async function getSuggestedJobs(): Promise<SuggestedJob[]> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) throw new Error('Unauthorized')

  console.log(`[Discover] Starting discovery for user: ${authUser.id}`)

  const { data: appUser } = await supabase
    .from('app_users')
    .select('target_roles')
    .eq('id', authUser.id)
    .maybeSingle()

  const { data: resume } = await supabase
    .from('resumes')
    .select('content')
    .eq('user_id', authUser.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!resume?.content) {
    console.warn(`[Discover] No resume content found for user ${authUser.id}.`)
    return [] 
  }

  // Determine search queries: Manual Preferences OR AI Extraction
  let queries: string[] = []
  
  if (appUser?.target_roles && appUser.target_roles.length > 0) {
    // Perform a separate search for each target role to get better variety
    queries = appUser.target_roles
  } else {
    // Fallback to AI extraction from resume
    const searchProfileResult = await runWithLLMRouter({
      prompt: `Analyze this resume and return a search query for a job board (Title + top 2 skills). Resume: ${resume.content.slice(0, 1000)}`,
      systemPrompt: "Return only a short search string, e.g. 'Senior React Developer TypeScript'. No explanation.",
      task: 'resume_analysis',
      temperature: 0
    })
    queries = [searchProfileResult.text.trim().replace(/^"|"$/g, '') || 'Software Engineer']
  }

  console.log(`[Discover] Running searches for: ${queries.join(', ')}`)

  // Run all searches in parallel
  const allResults = await Promise.all(queries.map(q => searchDiceJobs(q, 'Remote')))
  const flattenedDiceJobs = allResults.flat().filter(Boolean)
  
  // De-duplicate jobs by ID
  const seenIds = new Set<string>()
  const diceJobs = flattenedDiceJobs.filter(job => {
    const id = String(job.jobId || job.id)
    if (seenIds.has(id)) return false
    seenIds.add(id)
    return true
  })

  console.log(`[Discover] Dice returned ${diceJobs.length} unique raw results across all queries`)

  if (!diceJobs || diceJobs.length === 0) {
    return []
  }

  const rawSuggestions = diceJobs.map((job, index: number) => ({
    id: `dice-${job.jobId || index}`,
    company: job.companyName || 'Unknown Company',
    title: job.title || 'Software Engineer',
    location: job.location || 'Remote',
    salary: job.salary || 'Contact for info',
    source: 'dice' as const,
    url: job.detailUrl || '#',
    description: job.snippet || job.description || 'No description available.'
  }))

  const suggestionsWithScores = await Promise.all(rawSuggestions.map(async (suggestion) => {
    try {
      const prompt = `
        Resume Snippet: ${resume.content.slice(0, 2000)}
        ---
        Job: ${suggestion.title} at ${suggestion.company}
        Description: ${suggestion.description}
        ---
        Score this match 0-100 and give a 1-sentence reason.
        Return JSON: { "score": number, "reason": string }
      `

      const result = await runWithLLMRouter({
        prompt,
        systemPrompt: "You are an expert ATS matching engine. Be strict. If skills don't match, score low.",
        task: 'resume_analysis',
        temperature: 0.1
      })

      const cleanedText = result.text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(cleanedText)
      
      console.log(`[Discover] Scored "${suggestion.title}": ${parsed.score}%`)
      
      return {
        ...suggestion,
        matchScore: parsed.score ?? 0,
        matchReason: parsed.reason ?? 'Matches your profile.'
      } as SuggestedJob & { matchScore: number; matchReason: string }
    } catch (e) {
      console.error(`[Discover] Failed to score job ${suggestion.id}:`, e)
      return { ...suggestion, matchScore: 0, matchReason: 'Analysis failed.' } as SuggestedJob & { matchScore: number; matchReason: string }
    }
  }))

  const filtered = suggestionsWithScores.filter(j => j.matchScore >= 40)
  console.log(`[Discover] Final filtered results: ${filtered.length}`)

  return filtered.sort((a, b) => b.matchScore - a.matchScore)
}
