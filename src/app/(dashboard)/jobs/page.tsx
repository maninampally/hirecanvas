'use client'

import { useState } from 'react'
import { createJob } from '@/actions/jobs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { PageHeader } from '@/components/ui/page-header'
import { JobsTable } from '@/components/jobs/JobsTable'
import { JobForm } from '@/components/jobs/JobForm'
import { JobFormData } from '@/lib/validations/jobs'

export default function JobsPage() {
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  async function handleCreateJob(data: JobFormData) {
    try {
      setIsCreating(true)
      await createJob(data)
      setShowForm(false)
      setRefreshKey((k) => k + 1)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Applications"
        description="Track all your job applications in one place"
        action={{
          label: showForm ? 'Cancel' : '+ Add Job',
          onClick: () => setShowForm(!showForm),
        }}
      />

      {showForm && (
        <div className="animate-slide-down">
          <JobForm
            onSubmit={handleCreateJob}
            isLoading={isCreating}
          />
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        <Input
          placeholder="Search by title or company..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-44"
        >
          <option value="">All Statuses</option>
          <option value="Wishlist">Wishlist</option>
          <option value="Applied">Applied</option>
          <option value="Screening">Screening</option>
          <option value="Interview">Interview</option>
          <option value="Offer">Offer</option>
          <option value="Rejected">Rejected</option>
        </Select>
      </div>

      <JobsTable
        key={refreshKey}
        filters={{
          search: search || undefined,
          status: statusFilter || undefined,
        }}
      />
    </div>
  )
}
