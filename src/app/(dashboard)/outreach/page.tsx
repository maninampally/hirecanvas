'use client'

import { useEffect, useState } from 'react'
import {
  createOutreach,
  deleteOutreach,
  getOutreach,
  updateOutreach,
  type OutreachFormData,
  type OutreachStatus,
} from '@/actions/outreach'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { TableSkeletonRows } from '@/components/ui/table-skeleton-rows'
import { toast } from 'sonner'

type OutreachItem = {
  id: string
  company: string
  contact_name: string | null
  contact_email: string | null
  method: 'LinkedIn' | 'Email' | 'Phone' | 'WhatsApp' | null
  status: OutreachStatus
  notes: string | null
  outreach_date: string | null
}

const initialForm: OutreachFormData = {
  company: '',
  contact_name: '',
  contact_email: '',
  method: 'Email',
  status: 'draft',
  notes: '',
  outreach_date: '',
}

const statusClasses: Record<OutreachStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  sent: 'bg-blue-100 text-blue-700',
  replied: 'bg-emerald-100 text-emerald-700',
  no_response: 'bg-amber-100 text-amber-700',
}

export default function OutreachPage() {
  const [items, setItems] = useState<OutreachItem[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<OutreachStatus | ''>('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<OutreachFormData>(initialForm)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  async function loadData(currentSearch?: string, currentStatus?: OutreachStatus | '') {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getOutreach(currentSearch, currentStatus)
      setItems((data || []) as OutreachItem[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load outreach')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSaving(true)
    setError(null)
    setFormError(null)

    if (!form.company?.trim()) {
      setFormError('Company is required')
      setIsSaving(false)
      return
    }

    if (form.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email)) {
      setFormError('Please enter a valid contact email')
      setIsSaving(false)
      return
    }

    try {
      let saved: OutreachItem
      if (editingId) {
        saved = (await updateOutreach(editingId, form)) as OutreachItem
        setItems((prev) => prev.map((item) => (item.id === editingId ? saved : item)))
        toast.success('Outreach updated')
      } else {
        saved = (await createOutreach(form)) as OutreachItem
        setItems((prev) => [saved, ...prev])
        toast.success('Outreach created')
      }

      setForm(initialForm)
      setEditingId(null)
      setShowForm(false)
    } catch (err) {
      toast.error('Unable to save outreach')
      setError(err instanceof Error ? err.message : 'Failed to save outreach')
    } finally {
      setIsSaving(false)
    }
  }

  function handleEdit(item: OutreachItem) {
    setEditingId(item.id)
    setForm({
      company: item.company,
      contact_name: item.contact_name || '',
      contact_email: item.contact_email || '',
      method: item.method || 'Email',
      status: item.status,
      notes: item.notes || '',
      outreach_date: item.outreach_date || '',
    })
    setShowForm(true)
  }

  async function handleDelete(id: string) {
    setConfirmDeleteId(null)
    setPendingDeleteId(id)
    setError(null)
    const previous = items
    setItems((prev) => prev.filter((item) => item.id !== id))

    try {
      await deleteOutreach(id)
      toast.success('Outreach deleted')
    } catch (err) {
      setItems(previous)
      toast.error('Unable to delete outreach')
      setError(err instanceof Error ? err.message : 'Failed to delete outreach')
    } finally {
      setPendingDeleteId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Outreach</h1>
          <p className="text-slate-600 mt-1">Track your networking outreach</p>
        </div>
        <Button
          onClick={() => {
            setShowForm((prev) => !prev)
            if (showForm) {
              setEditingId(null)
              setForm(initialForm)
            }
          }}
        >
          {showForm ? 'Cancel' : '+ New Outreach'}
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search company or contact"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as OutreachStatus | '')}
          className="px-4 py-2 border border-slate-200 rounded-lg"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="replied">Replied</option>
          <option value="no_response">No Response</option>
        </select>
        <Button variant="outline" onClick={() => loadData(search, status)} disabled={isLoading}>
          Filter
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {formError}
                </p>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  required
                  placeholder="Company"
                  value={form.company || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, company: e.target.value }))}
                />
                <Input
                  placeholder="Contact name"
                  value={form.contact_name || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, contact_name: e.target.value }))}
                />
                <Input
                  placeholder="Contact email"
                  type="email"
                  value={form.contact_email || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, contact_email: e.target.value }))}
                />
                <Input
                  type="date"
                  value={form.outreach_date || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, outreach_date: e.target.value }))}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <select
                  value={form.method || 'Email'}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      method: e.target.value as OutreachFormData['method'],
                    }))
                  }
                  className="px-4 py-2 border border-slate-200 rounded-lg"
                >
                  <option value="Email">Email</option>
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="Phone">Phone</option>
                  <option value="WhatsApp">WhatsApp</option>
                </select>

                <select
                  value={form.status || 'draft'}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      status: e.target.value as OutreachStatus,
                    }))
                  }
                  className="px-4 py-2 border border-slate-200 rounded-lg"
                >
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="replied">Replied</option>
                  <option value="no_response">No Response</option>
                </select>
              </div>

              <textarea
                value={form.notes || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Notes"
                className="w-full min-h-24 rounded-lg border border-slate-200 px-4 py-3 text-sm"
              />

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? 'Saving...' : editingId ? 'Update Outreach' : 'Create Outreach'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr className="text-xs font-semibold text-slate-600 uppercase">
                  <th className="px-6 py-3 text-left">Company</th>
                  <th className="px-6 py-3 text-left">Contact</th>
                  <th className="px-6 py-3 text-left">Method</th>
                  <th className="px-6 py-3 text-left">Status</th>
                  <th className="px-6 py-3 text-left">Date</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {!isLoading && items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                      No outreach records yet.
                    </td>
                  </tr>
                )}

                {isLoading && (
                  <TableSkeletonRows
                    rowCount={3}
                    columns={['w-24', 'w-32', 'w-20', 'w-20', 'w-24', 'w-20']}
                  />
                )}

                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">{item.company}</td>
                    <td className="px-6 py-4 text-slate-700">
                      {item.contact_name || '-'}
                      <div className="text-xs text-slate-500">{item.contact_email || ''}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-700">{item.method || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusClasses[item.status]}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 text-sm">{item.outreach_date || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" className="text-teal-600" onClick={() => handleEdit(item)}>
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-rose-600"
                          onClick={() => setConfirmDeleteId(item.id)}
                          disabled={pendingDeleteId === item.id}
                        >
                          {pendingDeleteId === item.id ? 'Deleting...' : 'Delete'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(confirmDeleteId)}
        title="Delete outreach record?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        isLoading={Boolean(confirmDeleteId && pendingDeleteId === confirmDeleteId)}
        onCancel={() => {
          if (!pendingDeleteId) setConfirmDeleteId(null)
        }}
        onConfirm={() => {
          if (confirmDeleteId) void handleDelete(confirmDeleteId)
        }}
      />
    </div>
  )
}
