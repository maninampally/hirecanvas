'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { jobSchema, JobFormData } from '@/lib/validations/jobs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { StatusDropdown } from '@/components/ui/status-badge'

interface JobFormProps {
  onSubmit: (data: JobFormData) => Promise<void>
  initialData?: Partial<JobFormData>
  isLoading?: boolean
}

export function JobForm({ onSubmit, initialData, isLoading = false }: JobFormProps) {
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<JobFormData>({
    resolver: zodResolver(jobSchema),
    defaultValues: initialData || {
      status: 'Wishlist',
    },
  })

  const status = watch('status')

  const handleFormSubmit = async (data: JobFormData) => {
    try {
      setError(null)
      await onSubmit(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save job')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {initialData?.title ? 'Edit Job' : 'Add Job Application'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Job Title *
              </label>
              <Input
                placeholder="e.g., Senior Frontend Engineer"
                {...register('title')}
                disabled={isLoading || isSubmitting}
              />
              {errors.title && (
                <p className="text-xs text-rose-600 mt-1">{errors.title.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Company *
              </label>
              <Input
                placeholder="e.g., Google, Stripe"
                {...register('company')}
                disabled={isLoading || isSubmitting}
              />
              {errors.company && (
                <p className="text-xs text-rose-600 mt-1">{errors.company.message}</p>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Location
              </label>
              <Input
                placeholder="e.g., San Francisco, Remote"
                {...register('location')}
                disabled={isLoading || isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Salary
              </label>
              <Input
                placeholder="e.g., $150,000 - $180,000"
                {...register('salary')}
                disabled={isLoading || isSubmitting}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Status
            </label>
            <StatusDropdown
              value={status}
              onChange={(val) => register('status').onChange({ target: { value: val } })}
              disabled={isLoading || isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Job URL
            </label>
            <Input
              type="url"
              placeholder="https://..."
              {...register('url')}
              disabled={isLoading || isSubmitting}
            />
            {errors.url && (
              <p className="text-xs text-rose-600 mt-1">{errors.url.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Applied Date
            </label>
            <Input
              type="date"
              {...register('applied_date')}
              disabled={isLoading || isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Notes
            </label>
            <textarea
              placeholder="Add any notes about this job..."
              {...register('notes')}
              disabled={isLoading || isSubmitting}
              rows={4}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Save Job'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
