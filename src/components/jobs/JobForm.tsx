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
  const todayDate = new Date().toISOString().slice(0, 10)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<JobFormData>({
    resolver: zodResolver(jobSchema),
    defaultValues: initialData || {
      status: 'Wishlist',
      applied_date: todayDate,
    },
  })

  // eslint-disable-next-line react-hooks/incompatible-library
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
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">
          {initialData?.title ? 'Edit Job' : 'Add Job Application'}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-2.5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Job Title *
              </label>
              <Input
                placeholder="e.g., Senior Frontend Engineer"
                {...register('title')}
                className="h-10"
                disabled={isLoading || isSubmitting}
              />
              {errors.title && (
                <p className="text-xs text-rose-600 mt-1">{errors.title.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Company *
              </label>
              <Input
                placeholder="e.g., Google, Stripe"
                {...register('company')}
                className="h-10"
                disabled={isLoading || isSubmitting}
              />
              {errors.company && (
                <p className="text-xs text-rose-600 mt-1">{errors.company.message}</p>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Location
              </label>
              <Input
                placeholder="e.g., San Francisco, Remote"
                {...register('location')}
                className="h-10"
                disabled={isLoading || isSubmitting}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Salary
              </label>
              <Input
                placeholder="e.g., $150,000 - $180,000"
                {...register('salary')}
                className="h-10"
                disabled={isLoading || isSubmitting}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Status
              </label>
              <StatusDropdown
                value={status}
                onChange={(val) => register('status').onChange({ target: { value: val } })}
                disabled={isLoading || isSubmitting}
              />
            </div>
            <div className="md:col-span-1 xl:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Applied Date
              </label>
              <Input
                type="date"
                {...register('applied_date')}
                className="h-10"
                disabled={isLoading || isSubmitting}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Job URL
            </label>
            <Input
              type="url"
              placeholder="https://..."
              {...register('url')}
              className="h-10"
              disabled={isLoading || isSubmitting}
            />
            {errors.url && (
              <p className="text-xs text-rose-600 mt-1">{errors.url.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Notes
            </label>
            <textarea
              placeholder="Add any notes about this job..."
              {...register('notes')}
              disabled={isLoading || isSubmitting}
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
            />
          </div>

          <Button
            type="submit"
            className="w-full h-9"
            disabled={isLoading || isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Save Job'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
