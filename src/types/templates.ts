// Shared types for templates
export interface Template {
  id: string
  user_id: string | null
  name: string
  type: 'Email' | 'LinkedIn' | 'WhatsApp' | 'Cover Letter'
  category: string | null
  body: string
  is_archived: boolean
  created_at: string
  updated_at: string
}
