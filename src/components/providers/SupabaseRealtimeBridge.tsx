'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

type SupabaseRealtimeBridgeProps = {
  userId?: string
}

const USER_FILTERED_TABLES = [
  'jobs',
  'contacts',
  'outreach',
  'reminders',
  'templates',
  'resumes',
  'job_resumes',
  'offers',
  'notifications',
  'sync_status',
  'oauth_tokens',
  'processed_emails',
  'billing_events',
  'ai_usage',
] as const

const JOB_SCOPED_TABLES = ['job_status_timeline', 'job_emails'] as const

const TABLE_TO_QUERY_KEYS: Record<string, Array<readonly unknown[]>> = {
  jobs: [['jobs'], ['applications-sidebar']],
  job_resumes: [['jobs'], ['resumes']],
  job_emails: [['jobs'], ['applications-sidebar']],
  job_status_timeline: [['jobs'], ['applications-sidebar']],
  contacts: [['contacts']],
  outreach: [['outreach']],
  reminders: [['reminders']],
  templates: [['templates']],
  resumes: [['resumes'], ['jobs']],
  offers: [['offers']],
  notifications: [['notification-center']],
}

export function SupabaseRealtimeBridge({ userId }: SupabaseRealtimeBridgeProps) {
  const queryClient = useQueryClient()
  const supabase = useMemo(() => createClient(), [])
  const userJobIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!userId) return

    let mounted = true
    let invalidateTimer: ReturnType<typeof setTimeout> | null = null
    const pendingTargets = new Set<string>()

    const refreshUserJobIds = async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id')
        .eq('user_id', userId)

      if (!mounted || error) return
      userJobIdsRef.current = new Set((data || []).map((row) => row.id as string))
    }

    void refreshUserJobIds()

    const scheduleInvalidate = (table: string) => {
      pendingTargets.add(table)
      if (invalidateTimer) return
      invalidateTimer = setTimeout(() => {
        invalidateTimer = null
        const targets = [...pendingTargets]
        pendingTargets.clear()

        for (const target of targets) {
          const queryKeys = TABLE_TO_QUERY_KEYS[target]
          if (!queryKeys) {
            void queryClient.invalidateQueries()
            return
          }

          for (const queryKey of queryKeys) {
            void queryClient.invalidateQueries({ queryKey })
          }
        }
      }, 120)
    }

    const channel = supabase.channel(`cache-refresh-${userId}`)

    for (const table of USER_FILTERED_TABLES) {
      const callback =
        table === 'jobs'
          ? (payload: {
              eventType?: string
              new?: { id?: string }
              old?: { id?: string }
            }) => {
              const eventType = payload.eventType
              const insertedId = payload.new?.id
              const deletedId = payload.old?.id

              if (eventType === 'INSERT' && insertedId) {
                userJobIdsRef.current.add(insertedId)
              }
              if (eventType === 'DELETE' && deletedId) {
                userJobIdsRef.current.delete(deletedId)
              }

              scheduleInvalidate('jobs')
            }
          : () => scheduleInvalidate(table)

      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `user_id=eq.${userId}`,
        },
        callback
      )
    }

    for (const table of JOB_SCOPED_TABLES) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
        },
        (payload: { new?: { job_id?: string }; old?: { job_id?: string } }) => {
          const jobId = payload.new?.job_id || payload.old?.job_id
          if (!jobId) return
          if (!userJobIdsRef.current.has(jobId)) return
          scheduleInvalidate(table)
        }
      )
    }

    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'app_users',
        filter: `id=eq.${userId}`,
      },
      () => scheduleInvalidate('app_users')
    )

    channel.subscribe()

    return () => {
      mounted = false
      if (invalidateTimer) {
        clearTimeout(invalidateTimer)
      }
      void supabase.removeChannel(channel)
    }
  }, [queryClient, supabase, userId])

  return null
}