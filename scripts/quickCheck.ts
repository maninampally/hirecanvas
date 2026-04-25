import { runGemini, ProviderError } from '@/lib/ai/gemini'
import { runOpenAI } from '@/lib/ai/openai'
import { runClaude } from '@/lib/ai/claude'

async function main() {
  const req = {
    systemPrompt: 'Classify this email as job-related or not.',
    prompt: 'FROM: test@greenhouse.io\nSUBJECT: Thank you for applying\nBODY: We received your application.',
    temperature: 0,
    maxTokens: 300,
  }

  console.log('=== Testing each provider directly ===\n')

  // Gemini
  try {
    const r = await runGemini(req)
    console.log('✓ Gemini OK:', r.text.slice(0, 150))
  } catch(e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.log('✗ Gemini FAILED:', msg.slice(0, 200))
    if (e instanceof ProviderError) console.log('  statusCode:', e.statusCode, 'quotaError:', e.quotaError)
  }

  // OpenAI
  try {
    const r = await runOpenAI(req)
    console.log('✓ OpenAI OK:', r.text.slice(0, 150))
  } catch(e) {
    console.log('✗ OpenAI FAILED:', e instanceof Error ? e.message.slice(0, 200) : String(e))
  }

  // Claude
  try {
    const r = await runClaude(req)
    console.log('✓ Claude OK:', r.text.slice(0, 150))
  } catch(e) {
    console.log('✗ Claude FAILED:', e instanceof Error ? e.message.slice(0, 200) : String(e))
  }

  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
