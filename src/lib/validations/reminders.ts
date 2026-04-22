import { z } from 'zod'

export const reminderSchema = z.object({
  title: z.string().min(1, 'Title is required').max(300),
  type: z.enum(['Follow Up', 'Apply Deadline', 'Interview Prep', 'Other']).optional(),
  due_date: z.string().min(1, 'Due date is required'),
  notes: z.string().max(5000).optional(),
})

export type ReminderFormData = z.infer<typeof reminderSchema>
export type ReminderType = NonNullable<ReminderFormData['type']>
