'use server'

import { createClient } from '@/lib/supabase/server'

export type CalendarEvent = {
  id: string
  date: string
  type: 'interview' | 'reminder' | 'offer_deadline'
  title: string
  company?: string
  href: string
}

export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const events: CalendarEvent[] = []

  // Get jobs with interview dates
  const { data: interviewJobs } = await supabase
    .from('jobs')
    .select('id,company,title,interview_date')
    .eq('user_id', user.id)
    .not('interview_date', 'is', null)

  for (const job of interviewJobs || []) {
    if (job.interview_date) {
      events.push({
        id: `interview-${job.id}`,
        date: job.interview_date.slice(0, 10),
        type: 'interview',
        title: `Interview: ${job.title}`,
        company: job.company,
        href: '/applications',
      })
    }
  }

  // Get reminders with due dates
  const { data: reminders } = await supabase
    .from('reminders')
    .select('id,title,due_date')
    .eq('user_id', user.id)
    .not('due_date', 'is', null)

  for (const rem of reminders || []) {
    if (rem.due_date) {
      events.push({
        id: `reminder-${rem.id}`,
        date: rem.due_date.slice(0, 10),
        type: 'reminder',
        title: rem.title,
        href: '/reminders',
      })
    }
  }

  // Get offers with deadlines
  const { data: offers } = await supabase
    .from('offers')
    .select('id,company,deadline')
    .eq('user_id', user.id)
    .not('deadline', 'is', null)

  for (const offer of offers || []) {
    if (offer.deadline) {
      events.push({
        id: `offer-${offer.id}`,
        date: offer.deadline.slice(0, 10),
        type: 'offer_deadline',
        title: `Offer deadline: ${offer.company}`,
        company: offer.company,
        href: '/offers',
      })
    }
  }

  return events
}
