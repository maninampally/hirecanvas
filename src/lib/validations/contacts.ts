import { z } from 'zod'

export const contactSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().max(30).optional(),
  company: z.string().max(200).optional(),
  title: z.string().max(200).optional(),
  relationship: z.enum(['Recruiter', 'Hiring Manager', 'Employee', 'Other']).optional(),
  linkedin_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  notes: z.string().max(5000).optional(),
})

export type ContactFormData = z.infer<typeof contactSchema>
