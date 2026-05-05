'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { getJobs, deleteJob, updateJobStatus } from '@/actions/jobs'
import { getJobResumes, getResumeDownloadUrl, uploadJobResume } from '@/actions/resumeUpload'
import { Job } from '@/types/jobs'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusDropdown } from '@/components/ui/status-badge'
import { JobDetailDrawer } from './JobDetailDrawer'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { MdAdd, MdUploadFile, MdMoreHoriz, MdOpenInNew, MdDeleteOutline, MdFileDownload } from 'react-icons/md'
import { exportToCsv } from '@/lib/csvExport'

interface JobsTableProps {
  initialOpenJobId?: string | null
  /** Opens the real "Add job" form on the page (empty-state button). */
  onRequestAddJob?: () => void
  isExtracting?: boolean
  filters?: {
    status?: string
    statuses?: string[]
    search?: string
    appliedFrom?: string
    appliedTo?: string
    salaryMin?: number
    salaryMax?: number
  }
}

const STATUSES = ['Wishlist', 'Applied', 'Screening', 'Interview', 'Offer', 'Rejected', 'Closed']

export function JobsTable({ initialOpenJobId, onRequestAddJob, isExtracting, filters }: JobsTableProps) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(initialOpenJobId || null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(Boolean(initialOpenJobId))
  const [openActionMenuJobId, setOpenActionMenuJobId] = useState<string | null>(null)
  const [actionMenuPosition, setActionMenuPosition] = useState<{ top: number; left: number } | null>(null)
  const [openInEditMode, setOpenInEditMode] = useState(false)
  const [uploadingJobId, setUploadingJobId] = useState<string | null>(null)
  const resumeInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const actionMenuRef = useRef<HTMLDivElement | null>(null)

  // ── Bulk selection state (OBS-010) ─────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState('')
  const [isBulkUpdating, setIsBulkUpdating] = useState(false)

  const queryKey = useMemo(
    () => [
      'jobs',
      filters?.status || '',
      filters?.search || '',
      JSON.stringify(filters?.statuses || []),
      filters?.appliedFrom || '',
      filters?.appliedTo || '',
      filters?.salaryMin ?? '',
      filters?.salaryMax ?? '',
    ],
    [filters]
  )

  const jobsQuery = useQuery({
    queryKey,
    queryFn: async () => (await getJobs(filters)) as Job[],
  })

  const jobs = useMemo(() => {
    const rows = [...(jobsQuery.data || [])]
    rows.sort((a, b) => {
      const aTime = new Date(a.applied_date || a.created_at || a.updated_at).getTime()
      const bTime = new Date(b.applied_date || b.created_at || b.updated_at).getTime()
      return bTime - aTime
    })
    return rows
  }, [jobsQuery.data])

  const selectedJob = selectedJobId ? jobs.find((job) => job.id === selectedJobId) || null : null

  // Clear selection when jobs change
  useEffect(() => {
    setSelectedIds(new Set())
  }, [jobs])

  const allChecked = jobs.length > 0 && jobs.every((j) => selectedIds.has(j.id))
  const someChecked = selectedIds.size > 0 && !allChecked

  function toggleAll() {
    if (allChecked || someChecked) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(jobs.map((j) => j.id)))
    }
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const statusMutation = useMutation({
    mutationFn: async ({ jobId, newStatus }: { jobId: string; newStatus: string }) =>
      updateJobStatus(jobId, newStatus),
    onMutate: async ({ jobId, newStatus }) => {
      setError(null)
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<Job[]>(queryKey)
      queryClient.setQueryData<Job[]>(queryKey, (current = []) =>
        current.map((job) =>
          job.id === jobId ? { ...job, status: newStatus as Job['status'] } : job
        )
      )
      return { previous }
    },
    onError: (err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
      setError(err instanceof Error ? err.message : 'Failed to update status')
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (jobId: string) => deleteJob(jobId),
    onMutate: async (jobId) => {
      setError(null)
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<Job[]>(queryKey)
      queryClient.setQueryData<Job[]>(queryKey, (current = []) =>
        current.filter((job) => job.id !== jobId)
      )
      return { previous, jobId }
    },
    onError: (err, _jobId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
      setError(err instanceof Error ? err.message : 'Failed to delete job')
    },
    onSuccess: (_data, jobId) => {
      if (selectedJobId === jobId) {
        setSelectedJobId(null)
        setIsDrawerOpen(false)
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey })
    },
  })

  async function handleStatusChange(jobId: string, newStatus: string) {
    await statusMutation.mutateAsync({ jobId, newStatus })
  }

  async function handleDelete(jobId: string) {
    if (!confirm('Delete this job application?')) return
    await deleteMutation.mutateAsync(jobId)
  }

  // ── Bulk actions (OBS-010) ────────────────────────────────
  async function handleBulkStatusChange() {
    if (!bulkStatus || selectedIds.size === 0) return
    setIsBulkUpdating(true)
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) => updateJobStatus(id, bulkStatus))
      )
      await queryClient.invalidateQueries({ queryKey })
      toast.success(`Updated ${selectedIds.size} application${selectedIds.size > 1 ? 's' : ''} to "${bulkStatus}"`)
      setSelectedIds(new Set())
      setBulkStatus('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bulk update failed')
    } finally {
      setIsBulkUpdating(false)
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return
    if (!confirm(`Delete ${selectedIds.size} selected application${selectedIds.size > 1 ? 's' : ''}? This cannot be undone.`)) return
    setIsBulkUpdating(true)
    try {
      await Promise.all(Array.from(selectedIds).map((id) => deleteJob(id)))
      await queryClient.invalidateQueries({ queryKey })
      toast.success(`Deleted ${selectedIds.size} application${selectedIds.size > 1 ? 's' : ''}`)
      setSelectedIds(new Set())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bulk delete failed')
    } finally {
      setIsBulkUpdating(false)
    }
  }

  function handleBulkExport() {
    const selected = jobs.filter((j) => selectedIds.has(j.id))
    const rows = selected.map((j) => ({
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
    exportToCsv(`applications-selected-${new Date().toISOString().slice(0, 10)}`, rows)
    toast.success(`Exported ${rows.length} selected applications`)
  }

  async function handleResumeUpload(jobId: string, files: FileList | null) {
    if (!files?.length) return
    setUploadingJobId(jobId)
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        await uploadJobResume(jobId, formData)
      }
      toast.success(files.length > 1 ? 'Resumes uploaded' : 'Resume uploaded')
      await queryClient.invalidateQueries({ queryKey })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploadingJobId(null)
    }
  }

  async function getLatestResumeLink(jobId: string) {
    const resumes = await getJobResumes(jobId)
    const latestResume = resumes[0]

    if (!latestResume) {
      throw new Error('No resume uploaded for this job yet')
    }

    return getResumeDownloadUrl(latestResume.id)
  }

  async function handleResumeView(jobId: string) {
    try {
      const { url } = await getLatestResumeLink(jobId)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to open resume')
    }
  }

  function openDrawer(jobId: string) {
    setSelectedJobId(jobId)
    setOpenInEditMode(false)
    setIsDrawerOpen(true)
  }

  function openDrawerInEditMode(jobId: string) {
    setSelectedJobId(jobId)
    setOpenInEditMode(true)
    setIsDrawerOpen(true)
  }

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!actionMenuRef.current) return
      if (!actionMenuRef.current.contains(event.target as Node)) {
        setOpenActionMenuJobId(null)
        setActionMenuPosition(null)
      }
    }

    if (openActionMenuJobId) {
      document.addEventListener('mousedown', handleOutsideClick)
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [openActionMenuJobId])

  if (jobsQuery.isLoading) {
    return (
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50/80">
              <tr>
                {['Company', 'Role', 'Status', 'Applied', 'Resume', 'Action'].map((h) => (
                  <th key={h} className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <div className="h-3 w-16 rounded bg-slate-200 animate-pulse" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-6 py-4"><div className="h-4 w-28 rounded bg-slate-100 animate-pulse" /></td>
                  <td className="px-6 py-4"><div className="h-4 w-40 rounded bg-slate-100 animate-pulse" /></td>
                  <td className="px-6 py-4"><div className="h-6 w-20 rounded-full bg-slate-100 animate-pulse" /></td>
                  <td className="px-6 py-4"><div className="h-4 w-20 rounded bg-slate-100 animate-pulse" /></td>
                  <td className="px-6 py-4"><div className="h-8 w-20 rounded bg-slate-100 animate-pulse" /></td>
                  <td className="px-6 py-4"><div className="h-8 w-8 rounded bg-slate-100 animate-pulse ml-auto" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    )
  }

  const queryError = jobsQuery.error instanceof Error ? jobsQuery.error.message : null
  const hasListFilters =
    Boolean(filters?.appliedFrom || filters?.appliedTo) ||
    Boolean(filters?.statuses?.length) ||
    Boolean(filters?.status) ||
    Boolean(filters?.search)

  const drawer = (
    <JobDetailDrawer
      key={`${selectedJobId || 'no-selection'}:${openInEditMode ? 'edit' : 'view'}`}
      job={selectedJob}
      isOpen={isDrawerOpen}
      startInEditMode={openInEditMode}
      onClose={() => {
        setIsDrawerOpen(false)
        setSelectedJobId(null)
        setOpenInEditMode(false)
      }}
      onJobUpdated={() => {
        void queryClient.invalidateQueries({ queryKey })
      }}
    />
  )

  if (jobs.length === 0) {
    if (isExtracting) {
      return (
        <>
          <Card>
            <div className="p-8 text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-xl bg-teal-100 flex items-center justify-center text-teal-600 animate-pulse">
                <MdUploadFile className="text-2xl" />
              </div>
              <p className="text-slate-600 font-medium animate-pulse">Processing new emails...</p>
              <div className="max-w-md mx-auto space-y-2 mt-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />
                ))}
              </div>
            </div>
          </Card>
          {drawer}
        </>
      )
    }

    return (
      <>
        <Card>
          <div className="p-12 text-center space-y-4">
            {queryError ? (
              <p className="text-rose-700 text-sm">{queryError}</p>
            ) : (
              <>
                <p className="text-slate-600">
                  {hasListFilters
                    ? 'No jobs match the current filters. Try clearing the applied date range or status chips.'
                    : 'No jobs yet. Add an application manually, or run a Gmail sync from Settings (sync + extraction workers must be running).'}
                </p>
                <Button
                  type="button"
                  onClick={() => {
                    if (onRequestAddJob) {
                      onRequestAddJob()
                      return
                    }
                    toast.info('Use "+ Add Application" at the top of this page to create an application.')
                  }}
                >
                  Add application
                </Button>
              </>
            )}
          </div>
        </Card>
        {drawer}
      </>
    )
  }

  return (
    <>
      {/* ── Bulk Action Bar (OBS-010) ── */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 animate-slide-down">
          <span className="text-sm font-semibold text-indigo-700">
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value)}
              className="h-8 rounded-lg border border-indigo-200 bg-white px-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              <option value="">Change status…</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void handleBulkStatusChange()}
              disabled={!bulkStatus || isBulkUpdating}
              className="h-8 px-3 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-colors"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={handleBulkExport}
              disabled={isBulkUpdating}
              className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1 transition-colors"
            >
              <MdFileDownload className="text-sm" /> Export
            </button>
            <button
              type="button"
              onClick={() => void handleBulkDelete()}
              disabled={isBulkUpdating}
              className="h-8 px-3 rounded-lg border border-rose-200 bg-rose-50 text-xs font-semibold text-rose-600 hover:bg-rose-100 flex items-center gap-1 transition-colors"
            >
              <MdDeleteOutline className="text-sm" /> Delete
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="h-8 px-2 rounded-lg text-xs text-slate-400 hover:text-slate-600"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <Card className="animate-slide-up">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50/80">
              <tr>
                <th className="w-10 px-4 py-3.5">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={(el) => { if (el) el.indeterminate = someChecked }}
                    onChange={toggleAll}
                    aria-label="Select all applications"
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Company</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Applied</th>
                <th className="min-w-[11rem] px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Resume
                </th>
                <th className="px-6 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {jobs.map((job) => (
                <tr
                  key={job.id}
                  className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${selectedIds.has(job.id) ? 'bg-indigo-50/40' : ''}`}
                  onClick={() => {
                    openDrawer(job.id)
                  }}
                >
                  <td
                    className="w-10 px-4 py-4"
                    onClick={(e) => { e.stopPropagation(); toggleOne(job.id) }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(job.id)}
                      onChange={() => toggleOne(job.id)}
                      aria-label={`Select ${job.company} – ${job.title}`}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </td>
                  <td className="px-6 py-4 text-slate-800 font-medium">{job.company}</td>
                  <td className="px-6 py-4 align-top">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-indigo-600 hover:text-indigo-700 font-semibold text-sm">
                        {job.title}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      Updated {new Date(job.updated_at).toLocaleDateString()}
                    </p>
                  </td>
                  <td
                    className="px-6 py-4"
                    onClick={(event) => {
                      event.stopPropagation()
                    }}
                  >
                    <StatusDropdown
                      value={job.status}
                      onChange={(newStatus) => handleStatusChange(job.id, newStatus)}
                    />
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-sm">
                    {job.applied_date ? new Date(job.applied_date).toLocaleDateString() : '-'}
                  </td>
                  <td
                    className="min-w-[11rem] align-middle px-6 py-4"
                    onClick={(event) => {
                      event.stopPropagation()
                    }}
                  >
                    <input
                      ref={(el) => {
                        resumeInputRefs.current[job.id] = el
                      }}
                      type="file"
                      accept=".pdf,.doc,.docx,.txt,.rtf"
                      className="hidden"
                      multiple
                      disabled={uploadingJobId === job.id}
                      onChange={(e) => {
                        void handleResumeUpload(job.id, e.target.files)
                        e.target.value = ''
                      }}
                    />
                    {(job.resume_count ?? 0) === 0 ? (
                      <button
                        type="button"
                        disabled={uploadingJobId === job.id}
                        onClick={() => resumeInputRefs.current[job.id]?.click()}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-indigo-200 bg-indigo-50/60 px-3 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                      >
                        <MdUploadFile className="text-sm" />
                        {uploadingJobId === job.id ? 'Uploading...' : 'Upload'}
                      </button>
                    ) : (
                      <div className="inline-grid grid-flow-col auto-cols-max items-center gap-2">
                        <button
                          type="button"
                          title="View latest resume"
                          onClick={() => void handleResumeView(job.id)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-indigo-200 bg-white px-2.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 transition-colors"
                        >
                          <MdOpenInNew className="text-sm" />
                          View
                        </button>
                        <button
                          type="button"
                          title="Upload another resume"
                          disabled={uploadingJobId === job.id}
                          onClick={() => resumeInputRefs.current[job.id]?.click()}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-dashed border-indigo-200 bg-indigo-50/50 text-indigo-700 hover:bg-indigo-100 transition-colors disabled:opacity-50"
                        >
                          <MdAdd className="text-sm" />
                        </button>
                      </div>
                    )}
                  </td>
                  <td
                    className="px-6 py-4 text-right"
                    onClick={(event) => {
                      event.stopPropagation()
                    }}
                  >
                    <div className="flex justify-end items-center">
                      <button
                        type="button"
                        onClick={(event) => {
                          if (openActionMenuJobId === job.id) {
                            setOpenActionMenuJobId(null)
                            setActionMenuPosition(null)
                            return
                          }
                          const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect()
                          setOpenActionMenuJobId(job.id)
                          setActionMenuPosition({
                            top: rect.bottom + 6,
                            left: rect.right - 140,
                          })
                        }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                      >
                        <MdMoreHoriz className="text-lg" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {openActionMenuJobId && actionMenuPosition && (
        <div
          ref={actionMenuRef}
          className="fixed z-[100] w-36 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
          style={{ top: actionMenuPosition.top, left: actionMenuPosition.left }}
        >
          <button
            type="button"
            onClick={() => {
              const jobId = openActionMenuJobId
              setOpenActionMenuJobId(null)
              setActionMenuPosition(null)
              openDrawerInEditMode(jobId)
            }}
            className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => {
              const jobId = openActionMenuJobId
              setOpenActionMenuJobId(null)
              setActionMenuPosition(null)
              void handleDelete(jobId)
            }}
            className="block w-full rounded-md px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
          >
            Delete
          </button>
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">
          {error}
        </div>
      )}

      {!error && queryError && (
        <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">
          {queryError}
        </div>
      )}

      {drawer}
    </>
  )
}
