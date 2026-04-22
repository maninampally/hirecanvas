'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  deleteResume,
  getResumeDownloadUrl,
  getResumes,
  setDefaultResume,
  uploadResume,
  type ResumeItem,
} from '@/actions/resumes'
import { ATSChecker } from '@/components/resumes/ATSChecker'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from 'sonner'

export default function ResumesPage() {
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const [items, setItems] = useState<ResumeItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadResumes() {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getResumes()
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
      const uploaded = await uploadResume(formData)
      setItems((prev) => [uploaded, ...prev])
      toast.success('Resume uploaded')
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
      const updated = await setDefaultResume(id)
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, is_default: true }
            : { ...item, is_default: false }
        )
      )
      toast.success(`${updated.name} set as default`) 
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to set default resume'
      setError(message)
      toast.error(message)
    } finally {
      setPendingActionId(null)
    }
  }

  async function handleDelete(id: string) {
    setConfirmDeleteId(null)
    setPendingActionId(id)
    setError(null)

    const previous = items
    setItems((prev) => prev.filter((item) => item.id !== id))

    try {
      await deleteResume(id)
      toast.success('Resume deleted')
      await loadResumes()
    } catch (err) {
      setItems(previous)
      const message = err instanceof Error ? err.message : 'Failed to delete resume'
      setError(message)
      toast.error(message)
    } finally {
      setPendingActionId(null)
    }
  }

  async function handleDownload(id: string) {
    setPendingActionId(id)
    setError(null)
    try {
      const url = await getResumeDownloadUrl(id)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to download resume'
      setError(message)
      toast.error(message)
    } finally {
      setPendingActionId(null)
    }
  }

  function formatSize(size: number | null) {
    if (!size) return '-'
    if (size < 1024) return `${size} B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Resumes</h1>
          <p className="text-slate-600 mt-1">Upload and manage your resumes</p>
        </div>
        <div className="flex items-center gap-2">
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
              if (file) {
                void handleUpload(file)
              }
            }}
          />
          <Button onClick={() => uploadInputRef.current?.click()} disabled={isUploading}>
            {isUploading ? 'Uploading...' : '+ Upload Resume'}
          </Button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      <Card>
        <CardContent className="pt-6">
          {isLoading && <p className="text-slate-600">Loading resumes...</p>}

          {!isLoading && items.length === 0 && (
            <div className="py-10 text-center">
              <p className="text-slate-600 mb-4">Upload your first resume</p>
              <Button variant="outline" onClick={() => uploadInputRef.current?.click()} disabled={isUploading}>
                Upload
              </Button>
            </div>
          )}

          {!isLoading && items.length > 0 && (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-600 mt-1">
                        Version {item.version} • {item.file_type || 'Unknown type'} • {formatSize(item.file_size)}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Uploaded{' '}
                        {item.uploaded_at ? new Date(item.uploaded_at).toLocaleString() : new Date(item.created_at).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {item.is_default && (
                        <span className="rounded-full bg-teal-100 px-2.5 py-1 text-xs font-medium text-teal-700">
                          Default
                        </span>
                      )}

                      {!item.is_default && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleSetDefault(item.id)}
                          disabled={pendingActionId === item.id}
                        >
                          Set Default
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleDownload(item.id)}
                        disabled={pendingActionId === item.id}
                      >
                        Download
                      </Button>

                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setConfirmDeleteId(item.id)}
                        disabled={pendingActionId === item.id}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(confirmDeleteId)}
        title="Delete resume?"
        description="This will remove the file from storage and cannot be undone."
        confirmLabel="Delete"
        isLoading={Boolean(confirmDeleteId && pendingActionId === confirmDeleteId)}
        onCancel={() => {
          if (!pendingActionId) setConfirmDeleteId(null)
        }}
        onConfirm={() => {
          if (confirmDeleteId) void handleDelete(confirmDeleteId)
        }}
      />

      <div id="ats-checker">
        <ATSChecker />
      </div>
    </div>
  )
}
