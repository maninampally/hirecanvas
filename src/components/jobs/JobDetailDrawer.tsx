'use client'

import { useState } from 'react'
import { updateJob } from '@/actions/jobs'
import { JobFormData } from '@/lib/validations/jobs'
import { Job } from '@/types/jobs'
import { JobForm } from './JobForm'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface JobDetailDrawerProps {
  job: Job | null
  isOpen: boolean
  onClose: () => void
  onJobUpdated: () => void
}

const tabs = ['Overview', 'Email Log', 'Timeline', 'Notes & Prep', 'Submissions']

export function JobDetailDrawer({
  job,
  isOpen,
  onClose,
  onJobUpdated,
}: JobDetailDrawerProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('Overview')

  if (!isOpen || !job) return null

  async function handleSubmit(data: JobFormData) {
    try {
      if (!job) return
      setIsLoading(true)
      await updateJob(job.id, data)
      setIsEditing(false)
      onJobUpdated()
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white shadow-lg z-50 overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 sticky top-0 bg-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{job.title}</h2>
              <p className="text-slate-600">{job.company}</p>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-700 text-2xl font-light">
              ✕
            </button>
          </div>

          {/* Status & Actions */}
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                job.status === 'Interview'
                  ? 'bg-amber-100 text-amber-700'
                  : job.status === 'Applied'
                  ? 'bg-blue-100 text-blue-700'
                  : job.status === 'Offer'
                  ? 'bg-emerald-100 text-emerald-700'
                  : job.status === 'Rejected'
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {job.status}
            </span>
            <Button size="sm" variant="outline">+ Add Reminder</Button>
            <Button size="sm" variant="outline">📝 Draft</Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 px-6 flex gap-4 sticky top-24 bg-white overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 font-medium border-b-2 transition-colors text-sm whitespace-nowrap ${
                activeTab === tab
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {!isEditing ? (
            <>
              {activeTab === 'Overview' && (
                <div className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs text-slate-600 font-medium uppercase">Location</p>
                      <p className="text-slate-900 mt-1">{job.location || 'Not specified'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600 font-medium uppercase">Salary</p>
                      <p className="text-slate-900 mt-1">{job.salary || 'Not specified'}</p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs text-slate-600 font-medium uppercase">Applied Date</p>
                      <p className="text-slate-900 mt-1">
                        {job.applied_date ? new Date(job.applied_date).toLocaleDateString() : 'Not set'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600 font-medium uppercase">Created</p>
                      <p className="text-slate-900 mt-1">{new Date(job.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>

                  {job.url && (
                    <div>
                      <p className="text-xs text-slate-600 font-medium uppercase">Job Link</p>
                      <a href={job.url} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:text-teal-700 truncate mt-1 block">
                        {job.url}
                      </a>
                    </div>
                  )}

                  {job.notes && (
                    <div>
                      <p className="text-xs text-slate-600 font-medium uppercase">Notes</p>
                      <p className="text-slate-900 whitespace-pre-wrap mt-1">{job.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'Email Log' && (
                <div className="space-y-4">
                  {[
                    { date: '2 days ago', event: 'Application confirmation', sender: 'noreply@jobs.google.com' },
                    { date: '1 day ago', event: 'Interview scheduled', sender: 'recruiter@google.com' },
                    { date: 'Today', event: 'Interview details sent', sender: 'hiring.manager@google.com' },
                  ].map((log, i) => (
                    <Card key={i}>
                      <CardContent className="pt-6">
                        <p className="font-medium text-slate-900">{log.event}</p>
                        <p className="text-xs text-slate-600 mt-1">{log.sender}</p>
                        <p className="text-xs text-slate-500 mt-1">{log.date}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {activeTab === 'Timeline' && (
                <div className="space-y-4">
                  {[
                    { status: 'Wishlist', date: new Date(job.created_at).toLocaleDateString() },
                    { status: 'Applied', date: job.applied_date ? new Date(job.applied_date).toLocaleDateString() : '—' },
                    { status: 'Current', date: job.status },
                  ].map((item, i) => (
                    <div key={i} className="flex gap-4">
                      <div className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${job.status === item.status ? 'bg-teal-500' : 'bg-slate-300'}`} />
                      <div>
                        <p className="font-medium text-slate-900">{item.status}</p>
                        <p className="text-xs text-slate-600">{item.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'Notes & Prep' && (
                <div className="space-y-4">
                  <p className="font-medium text-slate-900 mb-3">Interview Questions</p>
                  {['Tell me about your experience with React', 'Describe a challenging project you worked on'].map((q, i) => (
                    <div key={i} className="p-3 bg-slate-50 rounded-lg">
                      <p className="font-medium text-sm text-slate-900">{q}</p>
                      <textarea placeholder="Your answer..." className="w-full mt-2 p-2 border border-slate-200 rounded text-sm" rows={2} />
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'Submissions' && (
                <div className="space-y-3">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-900">Resume_v2.pdf</p>
                          <p className="text-xs text-slate-600">432 KB • Uploaded 3 days ago</p>
                        </div>
                        <Button size="sm" variant="outline">Open</Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              <div className="border-t border-slate-200 pt-4 mt-6 flex gap-2">
                <Button onClick={() => setIsEditing(true)} className="flex-1">
                  Edit Details
                </Button>
                <Button variant="destructive" className="flex-1">
                  Delete
                </Button>
              </div>
            </>
          ) : (
            <>
              <JobForm initialData={job} onSubmit={handleSubmit} isLoading={isLoading} />
              <Button variant="outline" className="w-full mt-4" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
