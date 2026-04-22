import test from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeForAI } from '@/lib/ai/sanitizer'

test('sanitizeForAI redacts common PII patterns', () => {
  const input = 'SSN 123-45-6789 card 4111 1111 1111 1111 api_key=abc123'
  const result = sanitizeForAI(input)

  assert.equal(result.sanitizedText.includes('123-45-6789'), false)
  assert.equal(result.sanitizedText.includes('4111 1111 1111 1111'), false)
  assert.equal(result.sanitizedText.includes('api_key=abc123'), false)
  assert.deepEqual(result.piiFlags.sort(), ['credential_like', 'credit_card', 'ssn'])
  assert.equal(result.redactionCount >= 3, true)
})
