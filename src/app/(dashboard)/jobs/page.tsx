'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createJob, importJobsFromCsv } from '@/actions/jobs'
import { PageHeader } from '@/components/ui/page-header'
import { JobsTable } from '@/components/jobs/JobsTable'
import { JobForm } from '@/components/jobs/JobForm'
import { DateInput } from '@/components/ui/date-input'
import { JobFormData } from '@/lib/validations/jobs'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export default function JobsPage() {
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const initialOpenJobId = searchParams.get('jobId')
  const [showForm, setShowForm] = useState(false)
  const [statusFilters, setStatusFilters] = useState<string[]>([])
  const [appliedFrom, setAppliedFrom] = useState('')
  const [appliedTo, setAppliedTo] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
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

  async function handleCsvImport(file: File) {
    setIsImporting(true)
    try {
      const text = await file.text()
      const lines = text.split(/\r?\n/).filter(Boolean)
      if (lines.length < 2) throw new Error('CSV must include headers and at least one row.')

      const headers = lines[0].split(',').map((cell) => cell.trim().toLowerCase())
      const rows = lines.slice(1).map((line) => {
        const cols = line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''))
        const row: Record<string, string> = {}
        headers.forEach((header, idx) => {
          row[header] = cols[idx] || ''
        })
        const rawStatus = (row.status || '').toLowerCase()
        const status: JobFormData['status'] | undefined =
          rawStatus === 'wishlist' ? 'Wishlist' :
          rawStatus === 'applied' ? 'Applied' :
          rawStatus === 'screening' || rawStatus === 'screen' ? 'Screening' :
          rawStatus === 'interview' ? 'Interview' :
          rawStatus === 'offer' ? 'Offer' :
          rawStatus === 'rejected' ? 'Rejected' :
          undefined
        return {
          title: row.title,
          company: row.company,
          location: row.location,
          status,
          salary: row.salary,
          url: row.url,
          notes: row.notes,
          applied_date: row.applied_date,
        }
      })

      const result = await importJobsFromCsv(rows)
      await queryClient.invalidateQueries({ queryKey: ['jobs'] })
      setRefreshKey((k) => k + 1)
      toast.success(`Imported ${result.inserted} jobs${result.skipped ? `, skipped ${result.skipped}` : ''}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'CSV import failed')
    } finally {
      setIsImporting(false)
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

      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <label className="text-sm font-medium text-slate-700">Import CSV</label>
        <p className="text-xs text-slate-500">Headers: title, company, location, status, salary, url, notes, applied_date</p>
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={isImporting}
          className="mt-2 block text-sm"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void handleCsvImport(file)
            event.currentTarget.value = ''
          }}
        />
      </div>

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

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3">
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
            setAppliedFrom('')
            setAppliedTo('')
          }}
        >
          Clear Dates
        </button>
      </div>

      <JobsTable
        key={refreshKey}
        initialOpenJobId={initialOpenJobId}
        onRequestAddJob={() => {
          setShowForm(true)
          requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
        }}
        filters={{
          statuses: statusFilters.length > 0 ? statusFilters : undefined,
          appliedFrom: appliedFrom || undefined,
          appliedTo: appliedTo || undefined,
        }}
      />
    </div>
  )
}
