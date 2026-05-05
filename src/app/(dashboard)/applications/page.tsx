'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { createJob, getJobs } from '@/actions/jobs'
import { PageHeader } from '@/components/ui/page-header'
import { JobsTable } from '@/components/jobs/JobsTable'
import { JobForm } from '@/components/jobs/JobForm'
import { DateInput } from '@/components/ui/date-input'
import { JobFormData } from '@/lib/validations/jobs'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Job } from '@/types/jobs'
import { exportToCsv } from '@/lib/csvExport'

import { ReviewQueue } from '@/components/jobs/ReviewQueue'
import { useAuthStore } from '@/stores/authStore'
import { useSyncStatus } from '@/hooks/useSyncStatus'

export default function JobsPage() {
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const { user } = useAuthStore()
  const { extractionInProgress } = useSyncStatus(user?.id)
  const initialOpenJobId = searchParams.get('jobId')
  const [showForm, setShowForm] = useState(false)
  const [showReviewQueue, setShowReviewQueue] = useState(false)
  const [statusFilters, setStatusFilters] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [appliedFrom, setAppliedFrom] = useState('')
  const [appliedTo, setAppliedTo] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // Fetch all jobs to calculate status counts
  const { data: allJobs = [] } = useQuery({
    queryKey: ['jobs-all-counts'],
    queryFn: async () => (await getJobs({})) as Job[],
  })

  // Calculate status counts
  const statusCounts = useMemo(() => {
    const counts = {
      Wishlist: 0,
      Applied: 0,
      Screening: 0,
      Interview: 0,
      Offer: 0,
      Rejected: 0,
      Closed: 0,
    }
    allJobs.forEach((job) => {
      if (job.status && job.status in counts) {
        counts[job.status as keyof typeof counts]++
      }
    })
    return counts
  }, [allJobs])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // ... (keep existing handleCreateJob)

  async function handleCreateJob(data: JobFormData) {
    try {
      setIsCreating(true)
      await createJob(data)
      await queryClient.invalidateQueries({ queryKey: ['jobs'] })
      setShowForm(false)
      setRefreshKey((k) => k + 1)
      toast.success('Job created')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={showReviewQueue ? "Review Pending Jobs" : "Applications"}
        description={showReviewQueue ? "Review emails flagged by AI" : "Track and manage your job pipeline"}
        action={{
          label: showReviewQueue ? 'Back to Applications' : (showForm ? 'Cancel' : '+ Add Application'),
          onClick: () => {
            if (showReviewQueue) {
              setShowReviewQueue(false)
            } else {
              setShowForm(!showForm)
            }
          },
        }}
      >
        {!showReviewQueue && (
          <>
            <button
              type="button"
              onClick={() => {
                setShowReviewQueue(true)
                setShowForm(false)
              }}
              className="h-9 px-4 rounded-md border border-amber-200 bg-amber-50 text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors"
            >
              Review Pending
            </button>
            <button
              type="button"
              onClick={() => {
                const rows = allJobs.map((j) => ({
                  Company: j.company,
                  Role: j.title,
                  Status: j.status,
                  'Applied Date': j.applied_date ?? '',
                  Location: j.location ?? '',
                  Salary: j.salary ?? '',
                  Source: j.source ?? '',
                  URL: j.url ?? '',
                  Notes: j.notes ?? '',
                  'Created At': new Date(j.created_at).toLocaleDateString(),
                }))
                exportToCsv(`applications-${new Date().toISOString().slice(0, 10)}`, rows)
                toast.success(`Exported ${rows.length} applications`)
              }}
              className="h-9 px-4 rounded-md border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
          </>
        )}
      </PageHeader>

      {showReviewQueue ? (
        <ReviewQueue />
      ) : (
        <>
          {showForm && (
            <div className="animate-slide-down max-w-3xl">
              <JobForm onSubmit={handleCreateJob} isLoading={isCreating} />
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {(['All', 'Wishlist', 'Applied', 'Screening', 'Interview', 'Offer', 'Rejected', 'Closed'] as const).map((label) => {
              const value = label === 'All' ? '' : label
              const active = value === '' ? statusFilters.length === 0 : statusFilters.includes(value)
              const count = value === '' ? allJobs.length : (value in statusCounts ? statusCounts[value as keyof typeof statusCounts] : 0)
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    if (value === '') {
                      setStatusFilters([])
                      return
                    }
                    setStatusFilters([value])
                  }}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors flex items-center gap-2 ${
                    active
                      ? 'bg-indigo-500 text-white shadow-sm shadow-indigo-500/25'
                      : 'bg-transparent text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {label}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    active
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-200 text-slate-700'
                  }`}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="space-y-1 flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-slate-600">Search Company or Role</label>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">Applied From</label>
          <DateInput
            value={appliedFrom}
            onChange={setAppliedFrom}
            className="h-9 rounded-lg border border-slate-200 px-3 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">Applied To</label>
          <DateInput
            value={appliedTo}
            onChange={setAppliedTo}
            className="h-9 rounded-lg border border-slate-200 px-3 text-sm"
          />
        </div>
        <button
          type="button"
          className="h-9 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          onClick={() => {
            setSearchQuery('')
            setAppliedFrom('')
            setAppliedTo('')
          }}
        >
          Clear Filters
        </button>
      </div>

      <JobsTable
        key={refreshKey}
        initialOpenJobId={initialOpenJobId}
        isExtracting={extractionInProgress}
        onRequestAddJob={() => {
          setShowForm(true)
          requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
        }}
        filters={{
          statuses: statusFilters.length > 0 ? statusFilters : undefined,
          search: debouncedSearch || undefined,
          appliedFrom: appliedFrom || undefined,
          appliedTo: appliedTo || undefined,
        }}
      />
        </>
      )}
    </div>
  )
}
