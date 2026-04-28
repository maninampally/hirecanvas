import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { releaseSyncLock } from '@/lib/security/syncLock'
import { getExtractionQueue } from '@/lib/queue/extractionQueue'

export async function POST(req: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Find latest active sync and mark it as stopped
  const { data: latest } = await supabase
    .from('sync_status')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'in_progress')
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  if (latest) {
    await supabase
      .from('sync_status')
      .update({
        status: 'stopped',
        error_message: 'Manually stopped',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', latest.id)
  }

  await releaseSyncLock(user.id)

  // Drain pending extraction jobs so AI processing also stops.
  try {
    const extractionQueue = getExtractionQueue()
    await extractionQueue.drain()
  } catch {
    // Queue may not be available (no Redis); ignore.
  }

  return NextResponse.json({ success: true, message: 'Sync stopped' }, { status: 200 })
}
