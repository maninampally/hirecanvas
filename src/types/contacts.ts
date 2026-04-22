// Shared types for contacts
export interface Contact {
  id: string
  user_id: string
  name: string
  email: string | null
  phone: string | null
  company: string | null
  title: string | null
  relationship: 'Recruiter' | 'Hiring Manager' | 'Employee' | 'Other' | null
  linkedin_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
}
