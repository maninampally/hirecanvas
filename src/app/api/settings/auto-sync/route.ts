import { createClient } from '@/lib/supabase/server'
import { recordAuditEvent } from '@/lib/security/audit'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { auto_sync_time } = await request.json() as { auto_sync_time: string | null }

    // Validate tier
    const { data: userData, error: userError } = await supabase
      .from('app_users')
      .select('tier')
      .eq('id', user.id)
      .single<{ tier: string }>()

    if (userError || !userData) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    if (userData.tier !== 'elite') {
      return Response.json({ error: 'Auto-sync scheduling is only available for Elite plan users' }, { status: 403 })
    }

    // Validate time format if provided (HH:MM in 24-hour format)
    if (auto_sync_time) {
      const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/
      if (!timeRegex.test(auto_sync_time)) {
        return Response.json({ error: 'Invalid time format. Use HH:MM (24-hour).' }, { status: 400 })
      }
    }

    // Update user's auto_sync_time
    const { error: updateError } = await supabase
      .from('app_users')
      .update({ auto_sync_time })
      .eq('id', user.id)

    if (updateError) {
      return Response.json({ error: 'Failed to update auto-sync time' }, { status: 500 })
    }

    // Record audit event
    await recordAuditEvent({
      userId: user.id,
      eventType: 'user_settings_updated',
      action: 'auto_sync_time_updated',
      resourceType: 'user_settings',
      newValues: {
        auto_sync_time: auto_sync_time || 'disabled',
      },
    }).catch(() => {
      // Best-effort audit logging
    })

    return Response.json({ success: true, auto_sync_time })
  } catch (error) {
    console.error('[auto-sync-settings]', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData, error: userError } = await supabase
      .from('app_users')
      .select('auto_sync_time, tier')
      .eq('id', user.id)
      .single<{ auto_sync_time: string | null; tier: string }>()

    if (userError || !userData) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    return Response.json({
      auto_sync_time: userData.auto_sync_time,
      tier: userData.tier,
    })
  } catch (error) {
    console.error('[auto-sync-settings]', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
