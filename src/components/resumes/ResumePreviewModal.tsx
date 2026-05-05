'use client'

type ResumePreviewModalProps = {
  open: boolean
  onClose: () => void
  url: string
  fileName: string
  mimeType: string
}

function triggerFileDownload(url: string, fileName: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

export function ResumePreviewModal({ open, onClose, url, fileName, mimeType }: ResumePreviewModalProps) {
  if (!open) return null

  const isPdf = mimeType.toLowerCase().includes('pdf')

  function handleDownload() {
    triggerFileDownload(url, fileName)
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Resume preview"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
          <p className="min-w-0 truncate text-sm font-semibold text-slate-900">{fileName}</p>
          <div className="flex flex-shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700"
            >
              Download
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 bg-slate-100">
          {isPdf ? (
            <iframe title={fileName} src={url} className="h-[min(78vh,720px)] w-full border-0 bg-white" />
          ) : (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 p-8 text-center">
              <p className="max-w-md text-sm text-slate-600">
                Inline preview is available for PDF files. For Word or other formats, download the file to open it on
                your device.
              </p>
              <button
                type="button"
                onClick={handleDownload}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
              >
                Download file
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
