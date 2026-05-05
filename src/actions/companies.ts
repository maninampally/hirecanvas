'use server'

import { createClient } from '@/lib/supabase/server'

export type CompanyStats = {
  company: string
  totalApplications: number
  interviewRate: number
  avgResponseDays: number | null
  statuses: Record<string, number>
}

export async function getCompanies(): Promise<CompanyStats[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: jobs } = await supabase
    .from('jobs')
    .select('id,company,status,applied_date,created_at,updated_at')
    .eq('user_id', user.id)
    .eq('is_archived', false)

  if (!jobs || jobs.length === 0) return []

  const jobIds = jobs.map(j => j.id)
  const { data: timeline } = await supabase
    .from('job_status_timeline')
    .select('job_id,status,changed_at')
    .in('job_id', jobIds)
    .order('changed_at', { ascending: true })

  const timelineByJob = new Map<string, Array<{ status: string; changed_at: string }>>()
  for (const row of timeline || []) {
    const arr = timelineByJob.get(row.job_id) || []
    arr.push(row)
    timelineByJob.set(row.job_id, arr)
  }

  const companyMap = new Map<string, typeof jobs>()
  for (const job of jobs) {
    const key = (job.company || 'Unknown').trim().toLowerCase()
    const arr = companyMap.get(key) || []
    arr.push(job)
    companyMap.set(key, arr)
  }

  const responseStatuses = new Set(['Screening', 'Interview', 'Offer', 'Rejected'])

  const results: CompanyStats[] = []

  for (const [, companyJobs] of companyMap) {
    const displayName = companyJobs[0].company || 'Unknown'
    const total = companyJobs.length
    const interviews = companyJobs.filter(j =>
      ['Screening', 'Interview', 'Offer', 'Accepted'].includes(j.status)
    ).length
    const interviewRate = total > 0 ? Math.round((interviews / total) * 100) : 0

    let totalDays = 0
    let responseCount = 0
    const statuses: Record<string, number> = {}

    for (const job of companyJobs) {
      statuses[job.status] = (statuses[job.status] || 0) + 1
      
      const appliedAt = job.applied_date ? new Date(job.applied_date) : new Date(job.created_at)
      const events = timelineByJob.get(job.id) || []
      const firstResponse = events.find(e => responseStatuses.has(e.status))
      
      if (firstResponse) {
        const responseAt = new Date(firstResponse.changed_at)
        const days = (responseAt.getTime() - appliedAt.getTime()) / (1000 * 60 * 60 * 24)
        if (days >= 0) {
          totalDays += days
          responseCount += 1
        }
      }
    }

    results.push({
      company: displayName,
      totalApplications: total,
      interviewRate,
      avgResponseDays: responseCount > 0 ? Math.round((totalDays / responseCount) * 10) / 10 : null,
      statuses,
    })
  }

  return results.sort((a, b) => b.totalApplications - a.totalApplications)
}
