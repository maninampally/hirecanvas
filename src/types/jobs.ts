// Shared types for jobs
export interface Job {
  id: string
  title: string
  company: string
  location?: string
  status: 'Wishlist' | 'Applied' | 'Screening' | 'Interview' | 'Offer' | 'Rejected'
  salary?: string
  url?: string
  notes?: string
  applied_date?: string
  created_at: string
  updated_at: string
}

export type JobStatus = Job['status']
