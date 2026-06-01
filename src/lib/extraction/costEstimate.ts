/** Per-1K-token rates in USD (input / output). */
export const PROVIDER_COST_RATES = {
  gemini: { input: 0.00075, output: 0.003 },
  claude: { input: 0.003, output: 0.015 },
  openai: { input: 0.00015, output: 0.0006 },
  memzent: { input: 0.00015, output: 0.0006 },
} as const

/** Fractional cents for one LLM call — no per-stage floor (see `billPipelineCostCents`). */
export function estimateRawCostCents(
  provider: string,
  inputTokens: number,
  outputTokens: number
) {
  if (provider === 'regex_fallback' || provider === 'ollama') return 0
  if (!(provider in PROVIDER_COST_RATES)) return 0
  const rate = PROVIDER_COST_RATES[provider as keyof typeof PROVIDER_COST_RATES]
  const dollars =
    (inputTokens / 1000) * rate.input + (outputTokens / 1000) * rate.output
  return dollars * 100
}

/** One cent minimum per email when any stage used a paid provider. */
export function billPipelineCostCents(rawCostCents: number, totalTokens: number) {
  if (rawCostCents <= 0 && totalTokens <= 0) return 0
  if (rawCostCents <= 0) return 1
  return Math.max(1, Math.ceil(rawCostCents))
}
