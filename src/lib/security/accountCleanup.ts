import { createServiceClient } from '@/lib/supabase/service'
import { logInfo, logError } from '@/lib/observability/logger'

export async function processAccountCleanups() {
  const service = createServiceClient()
  const now = new Date().toISOString()

  logInfo('account_cleanup_started')

  // Find all users scheduled for deletion that have passed their grace period
  const { data: expiredUsers, error: findError } = await service
    .from('app_users')
    .select('id, full_name')
    .lte('scheduled_deletion_at', now)

  if (findError) {
    logError('account_cleanup_find_failed', findError)
    return
  }

  if (!expiredUsers || expiredUsers.length === 0) {
    logInfo('account_cleanup_no_users_found')
    return
  }

  logInfo('account_cleanup_processing', { count: expiredUsers.length })

  for (const user of expiredUsers) {
    try {
      // 1. Delete all related data first (mirroring delete-account API logic)
      await Promise.all([
        service.from('notifications').delete().eq('user_id', user.id),
        service.from('ai_usage').delete().eq('user_id', user.id),
        service.from('outreach').delete().eq('user_id', user.id),
        service.from('reminders').delete().eq('user_id', user.id),
        service.from('contacts').delete().eq('user_id', user.id),
        service.from('templates').delete().eq('user_id', user.id),
        service.from('oauth_tokens').delete().eq('user_id', user.id),
        service.from('notification_preferences').delete().eq('user_id', user.id),
        service.from('job_status_timeline').delete().eq('user_id', user.id),
        service.from('jobs').delete().eq('user_id', user.id),
      ])

      // 2. Delete the auth user (this will cascade to app_users if configured, 
      // but we do it via admin api for safety)
      const { error: deleteError } = await service.auth.admin.deleteUser(user.id)
      
      if (deleteError) {
        throw deleteError
      }

      logInfo('account_cleanup_success', { userId: user.id, name: user.full_name })
    } catch (err) {
      logError('account_cleanup_user_failed', err instanceof Error ? err : new Error(String(err)), { userId: user.id })
    }
  }

  logInfo('account_cleanup_completed', { count: expiredUsers.length })
}
