'use server'

import { createClient } from '@/lib/supabase/server'

export type SearchResult = {
  type: 'job' | 'contact' | 'email'
  id: string
  title: string
  subtitle: string
  href: string
}

export async function searchContent(query: string): Promise<SearchResult[]> {
  if (!query || query.length < 2) return []

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const pattern = `%${query}%`

  const [jobsRes, contactsRes, emailsRes] = await Promise.all([
    supabase
      .from('jobs')
      .select('id,company,title')
      .eq('user_id', user.id)
      .or(`company.ilike.${pattern},title.ilike.${pattern}`)
      .limit(5),
    supabase
      .from('contacts')
      .select('id,name,company')
      .eq('user_id', user.id)
      .or(`name.ilike.${pattern},company.ilike.${pattern}`)
      .limit(5),
    supabase
      .from('processed_emails')
      .select('id,subject,from_address')
      .eq('user_id', user.id)
      .ilike('subject', pattern)
      .limit(5),
  ])

  const results: SearchResult[] = []

  for (const job of jobsRes.data || []) {
    results.push({
      type: 'job',
      id: job.id,
      title: `${job.company} — ${job.title}`,
      subtitle: 'Job Application',
      href: '/applications',
    })
  }

  for (const contact of contactsRes.data || []) {
    results.push({
      type: 'contact',
      id: contact.id,
      title: contact.name || 'Unknown',
      subtitle: contact.company || 'Contact',
      href: '/contacts',
    })
  }

  for (const email of emailsRes.data || []) {
    results.push({
      type: 'email',
      id: email.id,
      title: email.subject || '(no subject)',
      subtitle: email.from_address || 'Email',
      href: '/sync-logs',
    })
  }

  return results
}
