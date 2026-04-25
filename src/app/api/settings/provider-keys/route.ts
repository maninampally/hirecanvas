import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Return which key slots are configured — never reveal values
  return NextResponse.json({
    gemini: [
      Boolean(process.env.GEMINI_API_KEY),
      Boolean(process.env.GEMINI_API_KEY_2),
      Boolean(process.env.GEMINI_API_KEY_3),
      Boolean(process.env.GEMINI_API_KEY_4),
      Boolean(process.env.GEMINI_API_KEY_5),
    ],
    openai: [
      Boolean(process.env.OPENAI_API_KEY),
      Boolean(process.env.OPENAI_API_KEY_2),
      Boolean(process.env.OPENAI_API_KEY_3),
      Boolean(process.env.OPENAI_API_KEY_4),
      Boolean(process.env.OPENAI_API_KEY_5),
    ],
    claude: [
      Boolean(process.env.ANTHROPIC_API_KEY),
    ],
  })
}
