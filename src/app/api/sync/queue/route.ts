import { NextResponse } from 'next/server'
import { getExtractionQueue } from '@/lib/queue/extractionQueue'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const queue = getExtractionQueue()
    const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed')
    
    // We get global counts, but this is usually sufficient for a general "system busy" indicator.
    return NextResponse.json({
      counts,
      isExtracting: counts.waiting > 0 || counts.active > 0 || counts.delayed > 0,
    })
  } catch (error) {
    console.error('[API] Queue status error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
