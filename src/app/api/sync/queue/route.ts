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
    
    // Get all extraction jobs and filter for current user only
    const jobs = await queue.getJobs(['waiting', 'active', 'delayed', 'failed', 'completed'], 0, -1)
    
    // Filter jobs by current user
    const userJobs = jobs.filter(job => job.data?.userId === user.id)
    
    // Count by status (a job is active if it has started but not finished)
    const counts = {
      waiting: userJobs.filter(j => !j.finishedOn && !j.progress).length,
      active: userJobs.filter(j => !j.finishedOn && j.progress !== undefined && j.progress !== null).length,
      completed: userJobs.filter(j => j.finishedOn && !j.failedReason).length,
      failed: userJobs.filter(j => j.finishedOn && j.failedReason).length,
      delayed: userJobs.filter(j => j.delay && !j.finishedOn).length,
    }
    
    return NextResponse.json({
      counts,
      isExtracting: counts.waiting > 0 || counts.active > 0 || counts.delayed > 0,
    })
  } catch (error) {
    console.error('[API] Queue status error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
