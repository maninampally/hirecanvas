'use client'

import { useState } from 'react'
import {
  createContact,
  deleteContact,
  getContacts,
  updateContact,
  type ContactFormData,
} from '@/actions/contacts'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { TableSkeletonRows } from '@/components/ui/table-skeleton-rows'
import { exportToCsv } from '@/lib/csvExport'
import { toast } from 'sonner'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

type Contact = {
  id: string
  name: string
  email: string | null
  company: string | null
  title: string | null
  relationship: 'Recruiter' | 'Hiring Manager' | 'Employee' | 'Other' | null
  notes?: string | null
}

const initialForm: ContactFormData = {
  name: '',
  email: '',
  company: '',
  title: '',
  relationship: 'Recruiter',
}

export default function ContactsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ContactFormData>(initialForm)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const queryKey = ['contacts', search]

  const contactsQuery = useQuery({
    queryKey,
    queryFn: async () => (await getContacts(search)) as Contact[],
  })

  const contacts = contactsQuery.data || []
  const isLoading = contactsQuery.isLoading

  const createMutation = useMutation({
    mutationFn: async (payload: ContactFormData) => (await createContact(payload)) as Contact,
    onSuccess: async (created) => {
      queryClient.setQueryData<Contact[]>(queryKey, (prev = []) => [created, ...prev])
      await queryClient.invalidateQueries({ queryKey })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: ContactFormData }) =>
      (await updateContact(id, payload)) as Contact,
    onSuccess: async (updated) => {
      queryClient.setQueryData<Contact[]>(queryKey, (prev = []) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      )
      await queryClient.invalidateQueries({ queryKey })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => deleteContact(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<Contact[]>(queryKey)
      queryClient.setQueryData<Contact[]>(queryKey, (prev = []) => prev.filter((item) => item.id !== id))
      return { previous }
    },
    onError: (_error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey })
    },
  })

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSaving(true)
    setError(null)
    setFormError(null)

    if (!form.name?.trim()) {
      setFormError('Name is required')
      setIsSaving(false)
      return
    }

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setFormError('Please enter a valid email address')
      setIsSaving(false)
      return
    }

    try {
      let saved: Contact
      if (editingId) {
        saved = await updateMutation.mutateAsync({ id: editingId, payload: form })
        queryClient.setQueryData<Contact[]>(queryKey, (prev = []) =>
          prev.map((item) => (item.id === editingId ? saved : item))
        )
        toast.success('Contact updated')
      } else {
        saved = await createMutation.mutateAsync(form)
        queryClient.setQueryData<Contact[]>(queryKey, (prev = []) => [saved, ...prev])
        toast.success('Contact created')
      }

      setForm(initialForm)
      setEditingId(null)
      setShowForm(false)
    } catch (err) {
      toast.error('Unable to save contact')
      setError(err instanceof Error ? err.message : 'Failed to save contact')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setConfirmDeleteId(null)
    setPendingDeleteId(id)
    setError(null)

    try {
      await deleteMutation.mutateAsync(id)
      toast.success('Contact deleted')
    } catch (err) {
      toast.error('Unable to delete contact')
      setError(err instanceof Error ? err.message : 'Failed to delete contact')
    } finally {
      setPendingDeleteId(null)
    }
  }

  function handleEdit(contact: Contact) {
    setEditingId(contact.id)
    setForm({
      name: contact.name,
      email: contact.email || '',
      company: contact.company || '',
      title: contact.title || '',
      relationship: contact.relationship || 'Recruiter',
    })
    setShowForm(true)
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <PageHeader
        title="Contacts"
        description="Manage recruiters and hiring managers"
        action={{
          label: showForm ? 'Cancel' : '+ Add Contact',
          onClick: () => {
            setShowForm((prev) => !prev)
            if (showForm) {
              setEditingId(null)
              setForm(initialForm)
            }
          },
        }}
      />

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <Input
              placeholder="Search by name, company, or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="sm:max-w-md"
            />
            <button
              type="button"
              onClick={() => {
                const rows = contacts.map((c) => ({
                  Name: c.name,
                  Email: c.email ?? '',
                  Company: c.company ?? '',
                  Title: c.title ?? '',
                  Relationship: c.relationship ?? '',
                  Notes: c.notes ?? '',
                }))
                exportToCsv(`contacts-${new Date().toISOString().slice(0, 10)}`, rows)
                toast.success(`Exported ${rows.length} contacts`)
              }}
              disabled={contacts.length === 0}
              className="h-9 px-4 rounded-md border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-1.5 disabled:opacity-40 shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
          </div>
        </CardContent>
      </Card>

      {showForm && (
        <Card>
          <CardContent className="pt-6">
            <form className="space-y-4" onSubmit={handleSubmit}>
              {formError && (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {formError}
                </p>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  placeholder="Full name"
                  value={form.name || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
                <Input
                  placeholder="Email"
                  type="email"
                  value={form.email || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                />
                <Input
                  placeholder="Company"
                  value={form.company || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, company: e.target.value }))}
                />
                <Input
                  placeholder="Role / Title"
                  value={form.title || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <Select
                value={form.relationship || 'Recruiter'}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    relationship: e.target.value as ContactFormData['relationship'],
                  }))
                }
                className="w-48"
              >
                <option value="Recruiter">Recruiter</option>
                <option value="Hiring Manager">Hiring Manager</option>
                <option value="Employee">Employee</option>
                <option value="Other">Other</option>
              </Select>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? 'Saving...' : editingId ? 'Update Contact' : 'Create Contact'}
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

      <Card className="animate-slide-up">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/80 border-b border-slate-200">
              <tr className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-3.5 text-left">Name</th>
                <th className="px-6 py-3.5 text-left hidden sm:table-cell">Company</th>
                <th className="px-6 py-3.5 text-left hidden md:table-cell">Role</th>
                <th className="px-6 py-3.5 text-left">Relationship</th>
                <th className="px-6 py-3.5 text-left hidden lg:table-cell">Notes</th>
                <th className="px-6 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {!isLoading && contacts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 max-w-xs mx-auto">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 text-teal-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-5.197-3.787M9 20H4v-2a4 4 0 015.197-3.787M15 11a4 4 0 11-8 0 4 4 0 018 0zm6 0a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <p className="font-semibold text-slate-800 text-base">{search ? 'No contacts match your search' : 'No contacts yet'}</p>
                      <p className="text-sm text-slate-500">{search ? 'Try a different name, email, or company.' : 'Add recruiters and hiring managers to stay organized and track your network.'}</p>
                      {!search && (
                        <button
                          type="button"
                          onClick={() => { setShowForm(true) }}
                          className="mt-1 rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-600 transition-colors"
                        >
                          + Add Contact
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {isLoading && (
                <TableSkeletonRows
                  rowCount={3}
                  columns={['w-28', 'w-24', 'w-24', 'w-20', 'w-36', 'w-20']}
                />
              )}

              {contacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 text-xs font-bold text-white shadow-sm">
                        {(contact.name?.charAt(0) || '?').toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{contact.name}</p>
                        <p className="truncate text-xs text-slate-400">{contact.email || '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-700 text-sm hidden sm:table-cell">{contact.company || '-'}</td>
                  <td className="px-6 py-4 text-slate-700 text-sm hidden md:table-cell">{contact.title || '-'}</td>
                  <td className="px-6 py-4">
                    <Badge
                      variant={contact.relationship === 'Recruiter' ? 'teal' : contact.relationship === 'Hiring Manager' ? 'blue' : contact.relationship === 'Employee' ? 'violet' : 'slate'}
                    >
                      {contact.relationship || 'Other'}
                    </Badge>
                  </td>
                  <td className="max-w-[200px] truncate px-6 py-4 text-xs text-slate-400 hidden lg:table-cell" title={contact.notes || undefined}>
                    {contact.notes || '—'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-teal-600"
                        onClick={() => handleEdit(contact)}
                        disabled={pendingDeleteId === contact.id}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-600"
                        onClick={() => setConfirmDeleteId(contact.id)}
                        disabled={pendingDeleteId === contact.id}
                      >
                        {pendingDeleteId === contact.id ? 'Deleting...' : 'Delete'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <ConfirmDialog
        open={Boolean(confirmDeleteId)}
        title="Delete contact?"
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
