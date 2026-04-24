/**
 * Deletes all auto_rejected processed_emails rows for a user, so that the next
 * range-sync re-evaluates them against the current pipeline (new fast-skip
 * patterns, new classifier thresholds, etc.).
 *
 * Keeps auto_accepted and needs_review rows untouched — those decisions
 * are correct and removing them would cause duplicate jobs.
 *
 * Usage:
 *   npm run reset:rejected -- <your-login-email>
 */
import { createServiceClient } from '@/lib/supabase/service'

async function main() {
  const email = process.argv[2]
  if (!email) {
    console.error('Usage: npm run reset:rejected -- <your-login-email>')
    process.exit(1)
  }

  const supabase = createServiceClient()

  const { data: userRow } = await supabase
    .from('app_users')
    .select('id,email')
    .eq('email', email)
    .maybeSingle<{ id: string; email: string }>()

  if (!userRow) {
    console.error(`User not found: ${email}`)
    process.exit(1)
  }

  const { count: before } = await supabase
    .from('processed_emails')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userRow.id)
    .eq('review_status', 'auto_rejected')

  console.log(`Deleting ${before ?? 0} auto_rejected rows for ${userRow.email}...`)

  const { error } = await supabase
    .from('processed_emails')
    .delete()
    .eq('user_id', userRow.id)
    .eq('review_status', 'auto_rejected')

  if (error) {
    console.error('Delete failed:', error.message)
    process.exit(1)
  }

  console.log('Done. Re-run your range sync from the UI to reprocess these emails.')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
