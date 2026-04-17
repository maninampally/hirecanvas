'use client'

import { useEffect, useState } from 'react'
import {
  createReminder,
  deleteReminder,
  getReminders,
  toggleReminderComplete,
  updateReminder,
  type ReminderFormData,
  type ReminderType,
} from '@/actions/reminders'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { TableSkeletonRows } from '@/components/ui/table-skeleton-rows'
import { toast } from 'sonner'

type Reminder = {
  id: string
  title: string
  type: ReminderType
  due_date: string
  notes: string | null
  completed_at: string | null
}

const initialForm: ReminderFormData = {
  title: '',
  type: 'Follow Up',
  due_date: '',
  notes: '',
}

function isOverdue(reminder: Reminder) {
  return !reminder.completed_at && new Date(reminder.due_date) < new Date()
}

export default function RemindersPage() {
  const [items, setItems] = useState<Reminder[]>([])
  const [showCompleted, setShowCompleted] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ReminderFormData>(initialForm)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null)

  async function loadData(includeCompleted: boolean) {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getReminders(includeCompleted)
      setItems((data || []) as Reminder[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reminders')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData(showCompleted)
  }, [showCompleted])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSaving(true)
    setError(null)
    setFormError(null)

    if (!form.title?.trim()) {
      setFormError('Title is required')
      setIsSaving(false)
      return
    }

    if (!form.due_date) {
      setFormError('Due date is required')
      setIsSaving(false)
      return
    }

    try {
      let saved: Reminder
      if (editingId) {
        saved = (await updateReminder(editingId, form)) as Reminder
        setItems((prev) => prev.map((item) => (item.id === editingId ? saved : item)))
        toast.success('Reminder updated')
      } else {
        saved = (await createReminder(form)) as Reminder
        setItems((prev) => [...prev, saved].sort((a, b) => a.due_date.localeCompare(b.due_date)))
        toast.success('Reminder created')
      }

      setEditingId(null)
      setForm(initialForm)
      setShowForm(false)
    } catch (err) {
      toast.error('Unable to save reminder')
      setError(err instanceof Error ? err.message : 'Failed to save reminder')
    } finally {
      setIsSaving(false)
    }
  }

  function handleEdit(item: Reminder) {
    setEditingId(item.id)
    setForm({
      title: item.title,
      type: item.type,
      due_date: item.due_date,
      notes: item.notes || '',
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
      await deleteReminder(id)
      toast.success('Reminder deleted')
    } catch (err) {
      setItems(previous)
      toast.error('Unable to delete reminder')
      setError(err instanceof Error ? err.message : 'Failed to delete reminder')
    } finally {
      setPendingDeleteId(null)
    }
  }

  async function handleToggleComplete(id: string, completed: boolean) {
    setPendingToggleId(id)
    setError(null)
    const previous = items
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              completed_at: completed ? new Date().toISOString() : null,
            }
          : item
      )
    )

    try {
      await toggleReminderComplete(id, completed)
      toast.success(completed ? 'Marked as complete' : 'Marked as incomplete')
    } catch (err) {
      setItems(previous)
      toast.error('Unable to update reminder status')
      setError(err instanceof Error ? err.message : 'Failed to update reminder status')
    } finally {
      setPendingToggleId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Reminders</h1>
          <p className="text-slate-600 mt-1">Stay on top of follow-ups and deadlines</p>
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
          {showForm ? 'Cancel' : '+ Add Reminder'}
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant={showCompleted ? 'outline' : 'default'}
          size="sm"
          onClick={() => setShowCompleted((prev) => !prev)}
          disabled={isLoading}
        >
          {showCompleted ? 'Hide Completed' : 'Show Completed'}
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
                  placeholder="Reminder title"
                  value={form.title || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                />

                <Input
                  required
                  type="date"
                  value={form.due_date || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, due_date: e.target.value }))}
                />
              </div>

              <select
                value={form.type || 'Follow Up'}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    type: e.target.value as ReminderType,
                  }))
                }
                className="px-4 py-2 border border-slate-200 rounded-lg"
              >
                <option value="Follow Up">Follow Up</option>
                <option value="Apply Deadline">Apply Deadline</option>
                <option value="Interview Prep">Interview Prep</option>
                <option value="Other">Other</option>
              </select>

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
                  {isSaving ? 'Saving...' : editingId ? 'Update Reminder' : 'Create Reminder'}
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
                  <th className="px-6 py-3 text-left">Done</th>
                  <th className="px-6 py-3 text-left">Title</th>
                  <th className="px-6 py-3 text-left">Type</th>
                  <th className="px-6 py-3 text-left">Due Date</th>
                  <th className="px-6 py-3 text-left">Notes</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {!isLoading && items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                      No reminders found.
                    </td>
                  </tr>
                )}

                {isLoading && (
                  <TableSkeletonRows
                    rowCount={3}
                    columns={['w-4', 'w-32', 'w-24', 'w-24', 'w-36', 'w-20']}
                  />
                )}

                {items.map((item) => (
                  <tr key={item.id} className={isOverdue(item) ? 'bg-rose-50/60' : 'hover:bg-slate-50'}>
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={Boolean(item.completed_at)}
                        onChange={(e) => handleToggleComplete(item.id, e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300"
                        disabled={pendingToggleId === item.id}
                      />
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900">{item.title}</td>
                    <td className="px-6 py-4 text-slate-700">{item.type}</td>
                    <td className="px-6 py-4 text-slate-700">{item.due_date}</td>
                    <td className="px-6 py-4 text-slate-600 text-sm">{item.notes || '-'}</td>
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
        title="Delete reminder?"
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
