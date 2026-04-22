'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRecentJobs, type RecentJobItem } from '@/actions/dashboard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type ApplicationsSidebarProps = {
  collapsed: boolean
  activeFilter: 'All' | 'Active' | 'Interview' | 'Offer'
  onFilterChange: (value: 'All' | 'Active' | 'Interview' | 'Offer') => void
}

const filters: Array<'All' | 'Active' | 'Interview' | 'Offer'> = ['All', 'Active', 'Interview', 'Offer']

function statusVariant(status: string): 'teal' | 'blue' | 'amber' | 'emerald' | 'rose' {
  if (status === 'Applied') return 'blue'
  if (status === 'Screening' || status === 'Interview') return 'amber'
  if (status === 'Offer') return 'emerald'
  if (status === 'Rejected') return 'rose'
  return 'teal'
}

function formatLastActivity(value: string) {
  const date = new Date(value)
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function ApplicationsSidebar({
  collapsed,
  activeFilter,
  onFilterChange,
}: ApplicationsSidebarProps) {
  const jobsQuery = useQuery({
    queryKey: ['applications-sidebar', activeFilter],
    queryFn: async () => (await getRecentJobs(20)) as RecentJobItem[],
  })

  const jobs = useMemo(() => jobsQuery.data || [], [jobsQuery.data])
  const filteredJobs = useMemo(() => {
    if (activeFilter === 'All') return jobs
    if (activeFilter === 'Interview') return jobs.filter((job) => job.status === 'Interview')
    if (activeFilter === 'Offer') return jobs.filter((job) => job.status === 'Offer')
    return jobs.filter((job) => ['Applied', 'Screening', 'Interview', 'Offer'].includes(job.status))
  }, [jobs, activeFilter])

  if (collapsed) return null

  return (
    <aside className="hidden xl:flex w-[300px] shrink-0 border-l border-slate-200 bg-white/80 backdrop-blur-sm">
      <div className="flex h-full w-full flex-col p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Applications</h3>
          <Link href="/jobs">
            <Button size="sm" variant="outline">New</Button>
          </Link>
        </div>

        <div className="mb-3 flex flex-wrap gap-1.5">
          {filters.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => onFilterChange(filter)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                activeFilter === filter
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {jobsQuery.isLoading && <p className="text-xs text-slate-500">Loading applications...</p>}
          {!jobsQuery.isLoading && filteredJobs.length === 0 && (
            <p className="text-xs text-slate-500">No applications in this filter.</p>
          )}

          {filteredJobs.map((job) => (
            <Link
              key={job.id}
              href={`/jobs?jobId=${job.id}`}
              className="block rounded-xl border border-slate-200 bg-white px-3 py-2 hover:border-indigo-200 hover:bg-indigo-50/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-900">{job.company}</p>
                  <p className="truncate text-[11px] text-slate-500">{job.title}</p>
                </div>
                <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">Last activity: {formatLastActivity(job.updated_at)}</p>
            </Link>
          ))}
        </div>
      </div>
    </aside>
  )
}

