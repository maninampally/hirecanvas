'use client'

import { useState, useEffect } from 'react'
import { getJobs, deleteJob, updateJobStatus } from '@/actions/jobs'
import { Job } from '@/types/jobs'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge, StatusDropdown } from '@/components/ui/status-badge'
import { JobDetailDrawer } from './JobDetailDrawer'

interface JobsTableProps {
  filters?: {
    status?: string
    search?: string
  }
}

export function JobsTable({ filters }: JobsTableProps) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  useEffect(() => {
    loadJobs()
  }, [filters])

  async function loadJobs() {
    try {
      setLoading(true)
      setError(null)
      const data = await getJobs(filters)
      setJobs(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs')
    } finally {
      setLoading(false)
    }
  }

  async function handleStatusChange(jobId: string, newStatus: string) {
    try {
      await updateJobStatus(jobId, newStatus)
      setJobs(
        jobs.map((job) =>
          job.id === jobId ? { ...job, status: newStatus as Job['status'] } : job
        )
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status')
    }
  }

  async function handleDelete(jobId: string) {
    if (!confirm('Delete this job application?')) return

    try {
      await deleteJob(jobId)
      setJobs(jobs.filter((job) => job.id !== jobId))
      setIsDrawerOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete job')
    }
  }

  if (loading) {
    return <div className="text-slate-600">Loading jobs...</div>
  }

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
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Company</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Applied</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <button
                      onClick={() => {
                        setSelectedJob(job)
                        setIsDrawerOpen(true)
                      }}
                      className="text-teal-600 hover:text-teal-700 font-medium"
                    >
                      {job.title}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-slate-700">{job.company}</td>
                  <td className="px-6 py-4 text-slate-600">{job.location || '-'}</td>
                  <td className="px-6 py-4">
                    <StatusDropdown
                      value={job.status}
                      onChange={(newStatus) => handleStatusChange(job.id, newStatus)}
                    />
                  </td>
                  <td className="px-6 py-4 text-slate-600 text-sm">
                    {job.applied_date ? new Date(job.applied_date).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDelete(job.id)}
                      className="text-rose-600 hover:text-rose-700 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {error && (
        <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">
          {error}
        </div>
      )}

      <JobDetailDrawer
        job={selectedJob}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false)
          setSelectedJob(null)
        }}
        onJobUpdated={loadJobs}
      />
    </>
  )
}
