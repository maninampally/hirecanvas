import assert from 'node:assert/strict'
import test from 'node:test'
import { billPipelineCostCents, estimateRawCostCents } from '@/lib/extraction/costEstimate'

test('accumulates fractional cents per stage and bills once per email', () => {
  const stage1 = estimateRawCostCents('gemini', 400, 100)
  const stage2 = estimateRawCostCents('gemini', 800, 200)
  const stage3 = estimateRawCostCents('openai', 600, 150)
  const total = stage1 + stage2 + stage3
  assert.ok(total > 0)
  assert.ok(total < 1)
  assert.equal(billPipelineCostCents(total, 2050), 1)
})

test('bills 1 cent when tokens used but raw cost is zero', () => {
  assert.equal(billPipelineCostCents(0, 500), 1)
})

test('tracks memzent provider rates', () => {
  assert.ok(estimateRawCostCents('memzent', 1000, 500) > 0)
})
