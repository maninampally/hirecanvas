'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createJob } from '@/actions/jobs'
import { PageHeader } from '@/components/ui/page-header'
import { JobsTable } from '@/components/jobs/JobsTable'
import { JobForm } from '@/components/jobs/JobForm'
import { JobFormData } from '@/lib/validations/jobs'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export default function JobsPage() {
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const initialOpenJobId = searchParams.get('jobId')
  const [showForm, setShowForm] = useState(false)
  const [statusFilters, setStatusFilters] = useState<string[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

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
        title="Applications"
        description="Track and manage your job pipeline"
        action={{
          label: showForm ? 'Cancel' : '+ Add Job',
          onClick: () => setShowForm(!showForm),
        }}
      />

      {showForm && (
        <div className="animate-slide-down max-w-3xl">
          <JobForm onSubmit={handleCreateJob} isLoading={isCreating} />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(['All', 'Wishlist', 'Applied', 'Screening', 'Interview', 'Offer', 'Rejected'] as const).map((label) => {
          const value = label === 'All' ? '' : label
          const active = value === '' ? statusFilters.length === 0 : statusFilters.includes(value)
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
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                active
                  ? 'bg-indigo-500 text-white shadow-sm shadow-indigo-500/25'
                  : 'bg-transparent text-slate-500 hover:bg-slate-100'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      <JobsTable
        key={refreshKey}
        initialOpenJobId={initialOpenJobId}
        filters={{
          statuses: statusFilters.length > 0 ? statusFilters : undefined,
        }}
      />
    </div>
  )
}
