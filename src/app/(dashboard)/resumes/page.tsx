'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  deleteResume,
  getUnifiedResumeList,
  getResumeSignedUrlForPreview,
  setDefaultResume,
  uploadResume,
  type UnifiedResumeRow,
} from '@/actions/resumes'
import { deleteJobResume } from '@/actions/resumeUpload'
import { ATSChecker } from '@/components/resumes/ATSChecker'
import { ResumePreviewModal } from '@/components/resumes/ResumePreviewModal'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from 'sonner'

export default function ResumesPage() {
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const [items, setItems] = useState<UnifiedResumeRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ kind: 'library' | 'job'; id: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [preview, setPreview] = useState<{ url: string; fileName: string; mimeType: string } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  async function loadResumes() {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getUnifiedResumeList()
      setItems(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load resumes')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadResumes()
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  async function handleUpload(file: File) {
    setIsUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.set('resume', file)
      await uploadResume(formData)
      toast.success('Resume uploaded')
      await loadResumes()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload resume'
      setError(message)
      toast.error(message)
    } finally {
      setIsUploading(false)
      if (uploadInputRef.current) {
        uploadInputRef.current.value = ''
      }
    }
  }

  async function handleSetDefault(id: string) {
    setPendingActionId(id)
    setError(null)
    try {
      await setDefaultResume(id)
      toast.success('Default resume updated')
      await loadResumes()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to set default resume'
      setError(message)
      toast.error(message)
    } finally {
      setPendingActionId(null)
    }
  }

  async function handleDelete(kind: 'library' | 'job', id: string) {
    setConfirmDelete(null)
    setPendingActionId(id)
    setError(null)

    try {
      if (kind === 'library') {
        await deleteResume(id)
      } else {
        await deleteJobResume(id)
      }
      toast.success('Resume removed')
      await loadResumes()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete resume'
      setError(message)
      toast.error(message)
    } finally {
      setPendingActionId(null)
    }
  }

  async function handleView(row: UnifiedResumeRow) {
    setPreviewLoading(true)
    setError(null)
    try {
      const bundle = await getResumeSignedUrlForPreview(
        row.kind === 'library'
          ? { kind: 'library', id: row.id }
          : { kind: 'job', id: row.id }
      )
      setPreview(bundle)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open preview'
      setError(message)
      toast.error(message)
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleDownloadRow(row: UnifiedResumeRow) {
    setPendingActionId(row.id)
    setError(null)
    try {
      const bundle = await getResumeSignedUrlForPreview(
        row.kind === 'library'
          ? { kind: 'library', id: row.id }
          : { kind: 'job', id: row.id }
      )
      const a = document.createElement('a')
      a.href = bundle.url
      a.download = bundle.fileName
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to download resume'
      setError(message)
      toast.error(message)
    } finally {
      setPendingActionId(null)
    }
  }

  function formatSize(size: number | null) {
    if (size == null) return '-'
    if (size < 1024) return `${size} B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
  }

  function rowLabel(row: UnifiedResumeRow): string {
    return row.kind === 'library' ? row.name : row.file_name
  }

  function rowMime(row: UnifiedResumeRow): string {
    return row.kind === 'library' ? row.file_type || '—' : row.mime_type
  }

  function rowDate(row: UnifiedResumeRow): string {
    const raw = row.kind === 'library' ? row.uploaded_at || row.created_at : row.created_at
    return new Date(raw).toLocaleString()
  }

  const libraryCount = items.filter((r) => r.kind === 'library').length
  const jobCount = items.filter((r) => r.kind === 'job').length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Resumes</h1>
          <p className="mt-1 text-slate-600">
            Upload and manage your resumes. Files you attach on{' '}
            <Link href="/applications" className="font-medium text-teal-700 hover:text-teal-900">
              Applications
            </Link>{' '}
            appear here automatically.
          </p>
          {!isLoading && items.length > 0 && (
            <p className="mt-2 text-xs text-slate-500">
              {libraryCount} in library
              {jobCount > 0 ? ` · ${jobCount} from applications` : ''}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href="#ats-checker">
            <Button variant="outline">ATS Checker</Button>
          </a>
          <Link href="/resumes/cover-letter">
            <Button variant="outline">AI Cover Letter</Button>
          </Link>
          <input
            ref={uploadInputRef}
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleUpload(file)
            }}
          />
          <Button onClick={() => uploadInputRef.current?.click()} disabled={isUploading}>
            {isUploading ? 'Uploading...' : '+ Upload Resume'}
          </Button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      )}

      <Card>
        <CardContent className="pt-6">
          {isLoading && (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-4 px-4 py-3">
                  <div className="h-4 w-56 rounded bg-slate-200" />
                  <div className="h-4 w-20 rounded bg-slate-200" />
                  <div className="h-4 w-16 rounded bg-slate-200" />
                  <div className="h-4 w-32 rounded bg-slate-200" />
                  <div className="ml-auto h-4 w-24 rounded bg-slate-200" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && items.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-16 max-w-sm mx-auto text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 text-teal-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-lg font-semibold text-slate-800">No resumes yet</p>
              <p className="text-sm text-slate-500">Upload your master resume here, or attach files directly to job applications — they&apos;ll appear automatically.</p>
              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                disabled={isUploading}
                className="mt-1 inline-flex items-center gap-2 rounded-lg bg-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-600 disabled:opacity-50 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {isUploading ? 'Uploading...' : 'Upload Resume'}
              </button>
            </div>
          )}

          {!isLoading && items.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/90">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-slate-600">Document</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Source</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Size</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Uploaded</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((row) => (
                    <tr key={`${row.kind}-${row.id}`} className="bg-white hover:bg-slate-50/80">
                      <td className="px-4 py-3 align-top">
                        <p className="font-medium text-slate-900">{rowLabel(row)}</p>
                        {row.kind === 'library' ? (
                          <p className="mt-0.5 text-xs text-slate-500">Version {row.version}</p>
                        ) : (
                          <p className="mt-0.5 text-xs text-slate-500">
                            {row.job_company} — {row.job_title}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {row.kind === 'library' ? (
                          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                            Library
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-800">
                            Application
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-slate-600">
                        <span className="block">{formatSize(row.kind === 'library' ? row.file_size : row.file_size)}</span>
                        <span className="text-xs text-slate-400">{rowMime(row)}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 align-top text-slate-600">{rowDate(row)}</td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-wrap justify-end gap-2">
                          {row.kind === 'library' && row.is_default && (
                            <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-700">
                              Default
                            </span>
                          )}
                          {row.kind === 'library' && !row.is_default && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void handleSetDefault(row.id)}
                              disabled={pendingActionId === row.id}
                            >
                              Set default
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleView(row)}
                            disabled={previewLoading || pendingActionId === row.id}
                          >
                            View
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleDownloadRow(row)}
                            disabled={pendingActionId === row.id}
                          >
                            Download
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setConfirmDelete({ kind: row.kind, id: row.id })}
                            disabled={pendingActionId === row.id}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete resume?"
        description={
          confirmDelete?.kind === 'job'
            ? 'This removes the file from this application. You can upload again from Applications.'
            : 'This will remove the file from storage and cannot be undone.'
        }
        confirmLabel="Delete"
        isLoading={Boolean(confirmDelete && pendingActionId === confirmDelete.id)}
        onCancel={() => {
          if (!pendingActionId) setConfirmDelete(null)
        }}
        onConfirm={() => {
          if (confirmDelete) void handleDelete(confirmDelete.kind, confirmDelete.id)
        }}
      />

      {preview && (
        <ResumePreviewModal
          open
          onClose={() => setPreview(null)}
          url={preview.url}
          fileName={preview.fileName}
          mimeType={preview.mimeType}
        />
      )}

      <div id="ats-checker">
        <ATSChecker />
      </div>
    </div>
  )
}
