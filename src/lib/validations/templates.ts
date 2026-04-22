import { z } from 'zod'

export const templateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(200),
  type: z.enum(['Email', 'LinkedIn', 'WhatsApp', 'Cover Letter']),
  category: z.string().max(100).optional(),
  body: z.string().min(1, 'Template body is required').max(10000),
})

export type TemplateFormData = z.infer<typeof templateSchema>
export type TemplateType = TemplateFormData['type']
