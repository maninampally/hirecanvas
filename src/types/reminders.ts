// Shared types for reminders
export interface Reminder {
  id: string
  user_id: string
  job_id: string | null
  title: string
  type: 'Follow Up' | 'Apply Deadline' | 'Interview Prep' | 'Other'
  notes: string | null
  due_date: string
  completed_at: string | null
  created_at: string
  updated_at: string
}
