import { z } from 'zod'

export const jobSchema = z.object({
  title: z.string().min(1, 'Job title required'),
  company: z.string().min(1, 'Company name required'),
  location: z.string().optional(),
  status: z.enum(['Wishlist', 'Applied', 'Screening', 'Interview', 'Offer', 'Rejected']),
  salary: z.string().optional(),
  url: z.string().url('Invalid URL').optional().or(z.literal('')),
  notes: z.string().optional(),
  applied_date: z.string().optional(),
})

export type JobFormData = z.infer<typeof jobSchema>
