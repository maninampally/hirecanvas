import { z } from 'zod'

export const outreachSchema = z.object({
  company: z.string().min(1, 'Company is required').max(200),
  contact_name: z.string().max(200).optional(),
  contact_email: z.string().email('Invalid email').optional().or(z.literal('')),
  method: z.enum(['LinkedIn', 'Email', 'Phone', 'WhatsApp']).optional(),
  status: z.enum(['draft', 'sent', 'replied', 'no_response']).optional(),
  notes: z.string().max(5000).optional(),
  outreach_date: z.string().optional(),
})

export type OutreachFormData = z.infer<typeof outreachSchema>
export type OutreachMethod = OutreachFormData['method']
export type OutreachStatus = OutreachFormData['status']
