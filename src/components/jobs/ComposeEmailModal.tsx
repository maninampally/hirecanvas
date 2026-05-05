'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { MdClose, MdSend } from 'react-icons/md'

type Template = {
  id: string
  name: string
  subject: string
  body: string
}

type ComposeEmailModalProps = {
  open: boolean
  onClose: () => void
  defaultTo?: string
  defaultSubject?: string
  jobContext?: {
    company?: string
    role?: string
    recruiterName?: string
  }
}

function ComposeEmailModalBody({
  onClose,
  defaultTo,
  defaultSubject,
  jobContext,
}: Omit<ComposeEmailModalProps, 'open'>) {
  const [to, setTo] = useState(defaultTo || '')
  const [subject, setSubject] = useState(defaultSubject || '')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])

  useEffect(() => {
    fetch('/api/templates')
      .then((res) => res.json())
      .then((data: Template[]) => setTemplates(data || []))
      .catch(() => {})
  }, [])

  function applyTemplate(template: Template) {
    let subj = template.subject
    let bod = template.body

    if (jobContext) {
      const replacements: Record<string, string> = {
        '{company}': jobContext.company || '',
        '{role}': jobContext.role || '',
        '{recruiter_name}': jobContext.recruiterName || '',
      }
      for (const [placeholder, value] of Object.entries(replacements)) {
        subj = subj.replaceAll(placeholder, value)
        bod = bod.replaceAll(placeholder, value)
      }
    }

    setSubject(subj)
    setBody(bod)
  }

  async function handleSend() {
    if (!to.trim()) { toast.error('Recipient is required'); return }
    if (!subject.trim()) { toast.error('Subject is required'); return }

    setSending(true)
    try {
      const res = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, body }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send')
      toast.success('Email sent successfully')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send email')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Compose Email</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
            <MdClose className="text-lg" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {templates.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Template</label>
              <select
                className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
                onChange={(e) => {
                  const t = templates.find(t => t.id === e.target.value)
                  if (t) applyTemplate(t)
                }}
                defaultValue=""
              >
                <option value="">Select a template...</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
              placeholder="recipient@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
              placeholder="Email subject"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-[160px] resize-y"
              placeholder="Write your email..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSend} disabled={sending} className="inline-flex items-center gap-2">
            <MdSend className="text-sm" />
            {sending ? 'Sending...' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function ComposeEmailModal(props: ComposeEmailModalProps) {
  const { open, onClose, defaultTo, defaultSubject, jobContext } = props
  if (!open) return null
  return (
    <ComposeEmailModalBody
      key={`${defaultTo ?? ''}|${defaultSubject ?? ''}`}
      onClose={onClose}
      defaultTo={defaultTo}
      defaultSubject={defaultSubject}
      jobContext={jobContext}
    />
  )
}
