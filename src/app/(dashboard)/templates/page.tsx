'use client'

import { useEffect, useState } from 'react'
import {
  createTemplate,
  deleteTemplate,
  getTemplates,
  updateTemplate,
  type TemplateFormData,
  type TemplateType,
} from '@/actions/templates'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { TableSkeletonRows } from '@/components/ui/table-skeleton-rows'
import { toast } from 'sonner'

type Template = {
  id: string
  user_id: string | null
  name: string
  type: TemplateType
  category: string | null
  body: string
}

const initialForm: TemplateFormData = {
  name: '',
  type: 'Email',
  category: '',
  body: '',
}

export default function TemplatesPage() {
  const [items, setItems] = useState<Template[]>([])
  const [search, setSearch] = useState('')
  const [type, setType] = useState<TemplateType | ''>('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<TemplateFormData>(initialForm)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  async function loadData(currentSearch?: string, currentType?: TemplateType | '') {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getTemplates(currentSearch, currentType)
      setItems((data || []) as Template[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates')
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

    if (!form.name?.trim()) {
      setFormError('Template name is required')
      setIsSaving(false)
      return
    }

    if (!form.body?.trim()) {
      setFormError('Template body is required')
      setIsSaving(false)
      return
    }

    try {
      let saved: Template
      if (editingId) {
        saved = (await updateTemplate(editingId, form)) as Template
        setItems((prev) => prev.map((item) => (item.id === editingId ? saved : item)))
        toast.success('Template updated')
      } else {
        saved = (await createTemplate(form)) as Template
        setItems((prev) => [saved, ...prev])
        toast.success('Template created')
      }

      setEditingId(null)
      setForm(initialForm)
      setShowForm(false)
    } catch (err) {
      toast.error('Unable to save template')
      setError(err instanceof Error ? err.message : 'Failed to save template')
    } finally {
      setIsSaving(false)
    }
  }

  function handleEdit(item: Template) {
    if (item.user_id === null) {
      setError('System templates are read-only')
      return
    }

    setEditingId(item.id)
    setForm({
      name: item.name,
      type: item.type,
      category: item.category || '',
      body: item.body,
    })
    setShowForm(true)
  }

  async function handleDelete(item: Template) {
    setConfirmDeleteId(null)

    if (item.user_id === null) {
      toast.error('System templates cannot be deleted')
      setError('System templates cannot be deleted')
      return
    }

    setPendingDeleteId(item.id)
    setError(null)
    const previous = items
    setItems((prev) => prev.filter((entry) => entry.id !== item.id))

    try {
      await deleteTemplate(item.id)
      toast.success('Template deleted')
    } catch (err) {
      setItems(previous)
      toast.error('Unable to delete template')
      setError(err instanceof Error ? err.message : 'Failed to delete template')
    } finally {
      setPendingDeleteId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Templates</h1>
          <p className="text-slate-600 mt-1">Email, LinkedIn, and cover letter templates</p>
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
          {showForm ? 'Cancel' : '+ New Template'}
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search templates"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as TemplateType | '')}
          className="px-4 py-2 border border-slate-200 rounded-lg"
        >
          <option value="">All types</option>
          <option value="Email">Email</option>
          <option value="LinkedIn">LinkedIn</option>
          <option value="WhatsApp">WhatsApp</option>
          <option value="Cover Letter">Cover Letter</option>
        </select>
        <Button variant="outline" onClick={() => loadData(search, type)} disabled={isLoading}>
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
                  placeholder="Template name"
                  value={form.name || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                />

                <Input
                  placeholder="Category (optional)"
                  value={form.category || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                />
              </div>

              <select
                value={form.type}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    type: e.target.value as TemplateType,
                  }))
                }
                className="px-4 py-2 border border-slate-200 rounded-lg"
              >
                <option value="Email">Email</option>
                <option value="LinkedIn">LinkedIn</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Cover Letter">Cover Letter</option>
              </select>

              <textarea
                required
                value={form.body}
                onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
                placeholder="Template body"
                className="w-full min-h-28 rounded-lg border border-slate-200 px-4 py-3 text-sm"
              />

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? 'Saving...' : editingId ? 'Update Template' : 'Create Template'}
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
                  <th className="px-6 py-3 text-left">Name</th>
                  <th className="px-6 py-3 text-left">Type</th>
                  <th className="px-6 py-3 text-left">Category</th>
                  <th className="px-6 py-3 text-left">Scope</th>
                  <th className="px-6 py-3 text-left">Preview</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {!isLoading && items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                      No templates found.
                    </td>
                  </tr>
                )}

                {isLoading && (
                  <TableSkeletonRows
                    rowCount={3}
                    columns={['w-28', 'w-20', 'w-24', 'w-20', 'w-40', 'w-20']}
                  />
                )}

                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">{item.name}</td>
                    <td className="px-6 py-4 text-slate-700">{item.type}</td>
                    <td className="px-6 py-4 text-slate-700">{item.category || '-'}</td>
                    <td className="px-6 py-4 text-slate-600 text-sm">
                      {item.user_id ? 'My Template' : 'System'}
                    </td>
                    <td className="px-6 py-4 text-slate-600 text-sm max-w-xs truncate">{item.body}</td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-teal-600"
                          onClick={() => handleEdit(item)}
                          disabled={pendingDeleteId === item.id}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-rose-600"
                          onClick={() => setConfirmDeleteId(item.id)}
                          disabled={pendingDeleteId === item.id || item.user_id === null}
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
        title="Delete template?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        isLoading={Boolean(confirmDeleteId && pendingDeleteId === confirmDeleteId)}
        onCancel={() => {
          if (!pendingDeleteId) setConfirmDeleteId(null)
        }}
        onConfirm={() => {
          const selected = items.find((entry) => entry.id === confirmDeleteId)
          if (selected) void handleDelete(selected)
        }}
      />
    </div>
  )
}
