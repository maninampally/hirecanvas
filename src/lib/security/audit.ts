import { createServiceClient } from '@/lib/supabase/service'

type RecordAuditEventInput = {
  userId?: string | null
  eventType: string
  action: string
  resourceType?: string
  resourceId?: string
  oldValues?: Record<string, unknown> | null
  newValues?: Record<string, unknown> | null
  ipAddress?: string | null
  userAgent?: string | null
}

export async function recordAuditEvent(input: RecordAuditEventInput) {
  try {
    const supabase = createServiceClient()

    await supabase.from('audit_log').insert({
      user_id: input.userId || null,
      event_type: input.eventType,
      resource_type: input.resourceType || null,
      resource_id: input.resourceId || null,
      action: input.action,
      old_values: input.oldValues || null,
      new_values: input.newValues || null,
      ip_address: input.ipAddress || null,
      user_agent: input.userAgent || null,
    })
  } catch {
    // Audit writes should never block user flows.
  }
}
