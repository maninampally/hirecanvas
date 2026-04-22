// Shared types for outreach
export interface Outreach {
  id: string
  user_id: string
  contact_id: string | null
  company: string
  contact_name: string | null
  contact_email: string | null
  method: 'LinkedIn' | 'Email' | 'Phone' | 'WhatsApp' | null
  status: 'draft' | 'sent' | 'replied' | 'no_response'
  notes: string | null
  outreach_date: string | null
  created_at: string
  updated_at: string
}
