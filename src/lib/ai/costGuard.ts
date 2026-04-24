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
  // Caps based on realistic extraction costs:
  // Each email costs ~$0.0003 (3 model calls × ~$0.0001 avg)
  // Elite/Admin: ~$1.00 = ~3,300 emails/day
  // Pro: ~$0.50 = ~1,650 emails/day (covers full 500-email initial sync)
  // Free: ~$0.05 = ~165 emails/day (if AI enabled for free tier)
  if (tier === 'elite' || tier === 'admin') return 100  // $1.00
  if (tier === 'pro') return 50                          // $0.50
  return 5                                               // $0.05
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
