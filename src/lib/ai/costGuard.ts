import { createServiceClient } from '@/lib/supabase/service'

export type UserTier = 'free' | 'pro' | 'elite' | 'admin'

export class DailyAIBudgetExceededError extends Error {
  readonly tier: UserTier
  readonly spentCents: number
  readonly dailyCapCents: number

  constructor(tier: UserTier, spentCents: number, dailyCapCents: number) {
    super(`DAILY_AI_BUDGET_EXCEEDED:${tier}:${spentCents}:${dailyCapCents}`)
    this.name = 'DailyAIBudgetExceededError'
    this.tier = tier
    this.spentCents = spentCents
    this.dailyCapCents = dailyCapCents
  }
}

function getDailyCapCents(tier: UserTier) {
  // Billed ~1 cent per email when the 3-stage pipeline runs (fractional raw cost,
  // floored once per email in writeAiUsage — not once per LLM stage).
  // Elite/Admin: $20.00 ≈ 2,000 extractions/day
  // Pro: $5.00 ≈ 500 extractions/day
  // Free: $2.00 ≈ 200 extractions/day (initial sync headroom)
  if (tier === 'elite' || tier === 'admin') return 2000 // $20.00
  if (tier === 'pro') return 500 // $5.00
  return 200 // $2.00
}

export async function assertWithinDailyAIBudget(userId: string, tier: UserTier) {
  const supabase = createServiceClient()
  const today = new Date().toISOString().slice(0, 10)
  const start = `${today}T00:00:00.000Z`

  const { data } = await supabase
    .from('ai_usage')
    .select('cost_cents')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .gte('created_at', start)

  const spentCents = (data || []).reduce((sum, row) => sum + (row.cost_cents || 0), 0)
  const dailyCapCents = getDailyCapCents(tier)

  if (spentCents >= dailyCapCents) {
    throw new DailyAIBudgetExceededError(tier, spentCents, dailyCapCents)
  }
}
