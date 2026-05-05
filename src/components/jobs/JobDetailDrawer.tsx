'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  archiveJob,
  getJobEmails,
  getJobTimeline,
  JobEmailEntry,
  JobTimelineEntry,
  updateJob,
  updateJobStatus,
} from '@/actions/jobs'
import {
  deleteJobResume,
  getJobResumes,
  type JobResumeItem,
  uploadJobResume,
} from '@/actions/resumeUpload'
import { JobFormData } from '@/lib/validations/jobs'
import { upsertOffer } from '@/actions/offers'
import { Job } from '@/types/jobs'
import { JobForm } from './JobForm'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusDropdown } from '@/components/ui/status-badge'
import { toast } from 'sonner'
import { MdUploadFile, MdDelete, MdInsertDriveFile, MdClose } from 'react-icons/md'

interface JobDetailDrawerProps {
  job: Job | null
  isOpen: boolean
  onClose: () => void
  onJobUpdated: () => void
  startInEditMode?: boolean
}

const tabs = ['Overview', 'Email Log', 'Timeline', 'Resume', 'Notes & Prep']

function formatDate(value?: string | null) {
  if (!value) return 'Not set'
  return new Date(value).toLocaleString()
}

function normalizeConfidence(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null
  const normalized = value <= 1 ? value * 100 : value
  return Math.max(0, Math.min(100, Math.round(normalized)))
}

function getExtractionQuality(providerHint?: string) {
  if (!providerHint) return { label: 'Unknown extraction', tone: 'bg-slate-100 text-slate-700' }
  if (providerHint === 'claude') return { label: 'AI-powered (Elite)', tone: 'bg-emerald-100 text-emerald-700' }
  if (providerHint === 'gemini') return { label: 'AI-powered (Pro)', tone: 'bg-indigo-100 text-indigo-700' }
  if (providerHint === 'regex_fallback') return { label: 'Basic extraction (Free)', tone: 'bg-amber-100 text-amber-800' }
  return { label: 'AI extraction', tone: 'bg-slate-100 text-slate-700' }
}

export function JobDetailDrawer({
  job,
  isOpen,
  onClose,
  onJobUpdated,
  startInEditMode = false,
}: JobDetailDrawerProps) {
  const [isEditing, setIsEditing] = useState(startInEditMode)
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('Overview')
  const [timeline, setTimeline] = useState<JobTimelineEntry[]>([])
  const [emails, setEmails] = useState<JobEmailEntry[]>([])
  const [resumes, setResumes] = useState<JobResumeItem[]>([])
  const [isLoadingDetails, setIsLoadingDetails] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [deletingResumeId, setDeletingResumeId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState(job?.notes || '')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const statusValue = useMemo(() => job?.status || 'Wishlist', [job?.status])

  useEffect(() => {
    if (!isOpen || !job) return

    let mounted = true

    void Promise.all([getJobTimeline(job.id), getJobEmails(job.id), getJobResumes(job.id)])
      .then(([timelineData, emailData, resumeData]) => {
        if (!mounted) return
        setTimeline(timelineData)
        setEmails(emailData)
        setResumes(resumeData)
      })
      .catch((error) => {
        if (!mounted) return
        toast.error(error instanceof Error ? error.message : 'Unable to load job details')
      })
      .finally(() => {
        if (mounted) setIsLoadingDetails(false)
      })

    return () => {
      mounted = false
    }
  }, [isOpen, job])

  if (!isOpen || !job) return null

  async function handleSubmit(data: JobFormData) {
    try {
      if (!job) return
      setIsLoading(true)
      await updateJob(job.id, data)
      toast.success('Job details updated')
      setIsEditing(false)
      onJobUpdated()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update job')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleStatusChange(newStatus: string) {
    try {
      if (!job) return
      setIsLoading(true)
      await updateJobStatus(job.id, newStatus)
      toast.success('Status updated')
      onJobUpdated()
      const latestTimeline = await getJobTimeline(job.id)
      setTimeline(latestTimeline)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update status')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSaveNote() {
    try {
      if (!job) return
      setIsLoading(true)
      await updateJob(job.id, { notes: noteDraft })
      toast.success('Note saved')
      onJobUpdated()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save note')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleArchive() {
    if (!job) return

    if (!confirm('Archive this application? It will be removed from the active jobs list.')) {
      return
    }

    try {
      setIsLoading(true)
      await archiveJob(job.id)
      toast.success('Job archived')
      onClose()
      onJobUpdated()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to archive job')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleResumeUpload(file: File) {
    if (!job) return
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const newResume = await uploadJobResume(job.id, formData)
      setResumes((prev) => [newResume, ...prev])
      toast.success(`${file.name} uploaded`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleResumeDelete(resumeId: string) {
    setDeletingResumeId(resumeId)
    try {
      await deleteJobResume(resumeId)
      setResumes((prev) => prev.filter((r) => r.id !== resumeId))
      toast.success('Resume deleted')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete resume')
    } finally {
      setDeletingResumeId(null)
    }
  }



  async function handleAddToOfferComparison() {
    if (!job) return
    try {
      setIsLoading(true)
      await upsertOffer({
        job_id: job.id,
        title: job.title,
        company: job.company,
      })
      toast.success('Added to Offer Comparison')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to add offer')
    } finally {
      setIsLoading(false)
    }
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/25" onClick={onClose} />

      {/* Drawer — ~460px on desktop, full width on small screens */}
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-[460px] overflow-y-auto border-l border-slate-200 bg-white shadow-[-8px_0_24px_rgba(0,0,0,0.08)]">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-6 py-5">
          {/* Breadcrumb */}
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-teal-600 transition-colors mb-3"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Applications
            <span className="text-slate-300 mx-1">/</span>
            <span className="text-slate-600 font-medium truncate max-w-[200px]">{job.company}</span>
          </button>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-bold tracking-tight text-slate-900">{job.title}</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {job.company}
                {job.location ? ` · ${job.location}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close"
            >
              <MdClose className="text-xl" />
            </button>
          </div>

          {/* Status & Actions */}
          <div className="flex items-center gap-3 flex-wrap">
            <StatusDropdown
              value={statusValue}
              onChange={handleStatusChange}
              disabled={isLoading}
            />
            {resumes.length > 0 && (
              <span className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 ring-1 ring-teal-200/70">
                {resumes.length} resume{resumes.length > 1 ? 's' : ''}
              </span>
            )}
            <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} disabled={isLoading}>
              Edit Details
            </Button>
            {job.status === 'Offer' && (
              <Button size="sm" onClick={handleAddToOfferComparison} disabled={isLoading}>
                Add to Offers
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={handleArchive} disabled={isLoading}>
              Archive
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="sticky top-28 z-10 flex gap-0.5 overflow-x-auto border-b border-slate-100 bg-white px-6">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-xs font-semibold capitalize tracking-wide transition-colors ${
                activeTab === tab
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
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
                  {isLoadingDetails && <p className="text-sm text-slate-600">Loading email thread...</p>}
                  {!isLoadingDetails && emails.length === 0 && (
                    <p className="text-sm text-slate-600">No synced emails for this job yet.</p>
                  )}
                  {emails.map((email) => (
                    <Card key={email.id}>
                      <CardContent className="pt-6">
                        <p className="font-medium text-slate-900">{email.subject}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <p className="text-xs text-slate-600">{email.from_address}</p>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              email.email_direction === 'outbound'
                                ? 'bg-teal-50 text-teal-700'
                                : email.email_direction === 'inbound'
                                  ? 'bg-indigo-50 text-indigo-700'
                                  : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {email.email_direction === 'outbound'
                              ? 'You sent'
                              : email.email_direction === 'inbound'
                                ? 'They sent'
                                : 'Unknown direction'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{formatDate(email.received_at)}</p>
                        {email.snippet && <p className="text-sm text-slate-700 mt-3">{email.snippet}</p>}
                        {email.extracted_data && (
                          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              Extraction
                            </p>
                            <p className="mt-1 text-xs text-slate-700">
                              Status path: {email.email_direction === 'outbound' ? 'outbound signal' : 'inbound signal'} →
                              {' '}
                              {email.extracted_data.source || 'unknown source'}
                              {email.extracted_data.inferredStatus ? ` → ${email.extracted_data.inferredStatus}` : ''}
                            </p>
                            <p className="text-xs text-slate-600 mt-1">
                              Provider: {email.extracted_data.providerHint || 'unknown'}
                              {email.extracted_data.model ? ` • ${email.extracted_data.model}` : ''}
                            </p>
                            <span
                              className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                getExtractionQuality(email.extracted_data.providerHint).tone
                              }`}
                            >
                              {getExtractionQuality(email.extracted_data.providerHint).label}
                            </span>
                            {typeof normalizeConfidence(email.extracted_data.extracted?.confidence) === 'number' && (
                              <p
                                className={`text-xs mt-1 ${
                                  (normalizeConfidence(email.extracted_data.extracted?.confidence) || 0) < 70
                                    ? 'text-rose-700 font-semibold'
                                    : 'text-slate-600'
                                }`}
                              >
                                Confidence: {normalizeConfidence(email.extracted_data.extracted?.confidence)}%
                                {(normalizeConfidence(email.extracted_data.extracted?.confidence) || 0) < 70
                                  ? ' • Low confidence, review recommended'
                                  : ''}
                              </p>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {activeTab === 'Timeline' && (() => {
                // Build unified feed from timeline + emails
                type FeedItem =
                  | { kind: 'status'; id: string; status: string; changed_at: string; notes?: string | null; ai_confidence_score?: number | null; requires_review?: boolean | null }
                  | { kind: 'email'; id: string; subject: string | null; from_address: string | null; received_at: string | null; email_direction: string | null }

                const statusColors: Record<string, string> = {
                  Wishlist: 'bg-teal-500',
                  Applied: 'bg-blue-500',
                  Screening: 'bg-amber-500',
                  Interview: 'bg-amber-500',
                  Offer: 'bg-emerald-500',
                  Accepted: 'bg-emerald-600',
                  Rejected: 'bg-rose-500',
                  Closed: 'bg-slate-400',
                }

                const feed: FeedItem[] = [
                  ...timeline.map((t) => ({ kind: 'status' as const, ...t })),
                  ...emails.map((e) => ({ kind: 'email' as const, ...e })),
                ].sort((a, b) => {
                  const aTime = a.kind === 'status' ? a.changed_at : (a.received_at ?? '')
                  const bTime = b.kind === 'status' ? b.changed_at : (b.received_at ?? '')
                  return new Date(bTime).getTime() - new Date(aTime).getTime()
                })

                return (
                  <div className="space-y-0">
                    {isLoadingDetails && (
                      <div className="space-y-4">
                        {[1, 2, 3, 4].map((i) => (
                          <div key={i} className="flex gap-3 animate-pulse">
                            <div className="w-3 h-3 rounded-full bg-slate-200 mt-1 flex-shrink-0" />
                            <div className="flex-1 space-y-1.5">
                              <div className="h-3 w-32 rounded bg-slate-100" />
                              <div className="h-3 w-48 rounded bg-slate-100" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {!isLoadingDetails && feed.length === 0 && (
                      <div className="py-8 text-center">
                        <p className="text-sm text-slate-500">No activity yet.</p>
                        <p className="text-xs text-slate-400 mt-1">Status changes and synced emails will appear here.</p>
                      </div>
                    )}
                    {!isLoadingDetails && feed.map((item, idx) => (
                      <div key={item.id} className={`flex gap-3 py-3 ${idx < feed.length - 1 ? 'border-b border-slate-100' : ''}`}>
                        {item.kind === 'status' ? (
                          <>
                            <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${statusColors[item.status] ?? 'bg-slate-400'}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-slate-900">Status → {item.status}</span>
                                {item.requires_review && (
                                  <span className="text-[10px] rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 font-semibold">Needs Review</span>
                                )}
                                {typeof item.ai_confidence_score === 'number' && (
                                  <span className={`text-[10px] rounded-full px-2 py-0.5 font-semibold ${item.ai_confidence_score < 70 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
                                    {item.ai_confidence_score}% confidence
                                  </span>
                                )}
                              </div>
                              {item.notes && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{item.notes}</p>}
                              <p className="text-[11px] text-slate-400 mt-0.5">{formatDate(item.changed_at)}</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 bg-indigo-400" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-slate-800 truncate">{item.subject || '(no subject)'}</span>
                                <span className={`text-[10px] rounded-full px-2 py-0.5 font-semibold flex-shrink-0 ${
                                  item.email_direction === 'outbound'
                                    ? 'bg-teal-50 text-teal-700'
                                    : item.email_direction === 'inbound'
                                      ? 'bg-indigo-50 text-indigo-700'
                                      : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {item.email_direction === 'outbound' ? 'You sent' : item.email_direction === 'inbound' ? 'They sent' : 'Email'}
                                </span>
                              </div>
                              {item.from_address && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{item.from_address}</p>}
                              <p className="text-[11px] text-slate-400 mt-0.5">{formatDate(item.received_at)}</p>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })()}


              {activeTab === 'Resume' && (
                <div className="space-y-4">
                  {/* Upload zone */}
                  <div
                    className="relative border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center hover:border-teal-400 hover:bg-teal-50/30 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <MdUploadFile className="mx-auto text-3xl text-slate-400 mb-2" />
                    <p className="text-sm font-medium text-slate-700">
                      {isUploading ? 'Uploading...' : 'Click to upload resume'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">PDF, DOC, DOCX, TXT, RTF — max 10MB</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.txt,.rtf"
                      disabled={isUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) void handleResumeUpload(file)
                      }}
                    />
                  </div>

                  {/* Resume list */}
                  {resumes.length === 0 && !isLoadingDetails && (
                    <p className="text-sm text-slate-500">No resumes uploaded for this job.</p>
                  )}
                  {resumes.length > 0 && (
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Uploaded ({resumes.length})
                    </p>
                  )}
                  {resumes.map((resume) => (
                    <div key={resume.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center flex-shrink-0">
                          <MdInsertDriveFile className="text-xl" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{resume.file_name}</p>
                          <p className="text-xs text-slate-400">
                            {formatFileSize(resume.file_size)} • {new Date(resume.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => void handleResumeDelete(resume.id)}
                          disabled={deletingResumeId === resume.id}
                          className="h-8 w-8 rounded-lg border border-rose-200 bg-rose-50 text-rose-500 hover:text-rose-600 transition-colors disabled:opacity-50 flex items-center justify-center"
                          title="Delete"
                        >
                          <MdDelete className="text-lg" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'Notes & Prep' && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-700">Add private notes for follow-ups, interview prep, and context.</p>
                  <textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    rows={8}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                    placeholder="Type your notes here..."
                  />
                  <Button onClick={handleSaveNote} disabled={isLoading}>
                    Save Note
                  </Button>
                </div>
              )}

              <div className="border-t border-slate-200 pt-4 mt-6" />
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
