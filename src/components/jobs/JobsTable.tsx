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
import { MdAdd, MdUploadFile, MdMoreHoriz, MdDownload, MdOpenInNew } from 'react-icons/md'

interface JobsTableProps {
  initialOpenJobId?: string | null
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

export function JobsTable({ initialOpenJobId, filters }: JobsTableProps) {
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

  const jobs = useMemo(() => jobsQuery.data || [], [jobsQuery.data])

  const selectedJob = selectedJobId ? jobs.find((job) => job.id === selectedJobId) || null : null

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

  async function handleResumeDownload(jobId: string) {
    try {
      const { url, fileName } = await getLatestResumeLink(jobId)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      link.click()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to download resume')
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
    return <div className="text-slate-600">Loading jobs...</div>
  }

  const queryError = jobsQuery.error instanceof Error ? jobsQuery.error.message : null

  if (jobs.length === 0) {
    return (
      <Card>
        <div className="p-12 text-center">
          <p className="text-slate-600 mb-4">No jobs yet. Add your first application!</p>
          <Button onClick={() => setIsDrawerOpen(true)}>Add Job</Button>
        </div>
      </Card>
    )
  }

  return (
    <>
      <Card className="animate-slide-up">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50/80">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Company</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Applied</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Resume</th>
                <th className="px-6 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {jobs.map((job) => (
                <tr
                  key={job.id}
                  className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                  onClick={() => {
                    openDrawer(job.id)
                  }}
                >
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
                    className="px-6 py-4"
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
                      <div className="flex items-center gap-2 flex-wrap">
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
                          title="Download latest resume"
                          onClick={() => void handleResumeDownload(job.id)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-indigo-200 bg-white px-2.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 transition-colors"
                        >
                          <MdDownload className="text-sm" />
                          Download
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
    </>
  )
}
