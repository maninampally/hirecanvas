'use client'

import { useEffect, useState } from 'react'
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
import { toast } from 'sonner'

type Contact = {
  id: string
  name: string
  email: string | null
  company: string | null
  title: string | null
  relationship: 'Recruiter' | 'Hiring Manager' | 'Employee' | 'Other' | null
}

const initialForm: ContactFormData = {
  name: '',
  email: '',
  company: '',
  title: '',
  relationship: 'Recruiter',
}

const relationshipClasses: Record<string, string> = {
  Recruiter: 'bg-teal-100 text-teal-700',
  'Hiring Manager': 'bg-blue-100 text-blue-700',
  Employee: 'bg-violet-100 text-violet-700',
  Other: 'bg-slate-100 text-slate-700',
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ContactFormData>(initialForm)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  async function loadContacts(currentSearch?: string) {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getContacts(currentSearch)
      setContacts((data || []) as Contact[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contacts')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadContacts()
  }, [])

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
        saved = (await updateContact(editingId, form)) as Contact
        setContacts((prev) => prev.map((item) => (item.id === editingId ? saved : item)))
        toast.success('Contact updated')
      } else {
        saved = (await createContact(form)) as Contact
        setContacts((prev) => [saved, ...prev])
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
    const previous = contacts
    setContacts((prev) => prev.filter((item) => item.id !== id))

    try {
      await deleteContact(id)
      toast.success('Contact deleted')
    } catch (err) {
      setContacts(previous)
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
    <div className="space-y-6">
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

      <div className="flex gap-3">
        <Input
          placeholder="Search by name, company, or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
        <Button variant="outline" onClick={() => loadContacts(search)} disabled={isLoading}>
          Search
        </Button>
      </div>

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

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr className="text-xs font-semibold text-slate-600 uppercase">
                <th className="px-6 py-3 text-left">Name</th>
                <th className="px-6 py-3 text-left">Role</th>
                <th className="px-6 py-3 text-left">Company</th>
                <th className="px-6 py-3 text-left">Relationship</th>
                <th className="px-6 py-3 text-left">Email</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {!isLoading && contacts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                    No contacts found.
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
                <tr key={contact.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">{contact.name}</td>
                  <td className="px-6 py-4 text-slate-700">{contact.title || '-'}</td>
                  <td className="px-6 py-4 text-slate-700">{contact.company || '-'}</td>
                  <td className="px-6 py-4">
                    <Badge
                      variant={contact.relationship === 'Recruiter' ? 'teal' : contact.relationship === 'Hiring Manager' ? 'blue' : contact.relationship === 'Employee' ? 'violet' : 'slate'}
                    >
                      {contact.relationship || 'Other'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-slate-600 text-sm">{contact.email || '-'}</td>
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
