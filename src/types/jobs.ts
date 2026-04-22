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
  is_archived?: boolean
  created_at: string
  updated_at: string
  /** Populated by getJobs when job_resumes aggregate is available */
  resume_count?: number
}

export type JobStatus = Job['status']
