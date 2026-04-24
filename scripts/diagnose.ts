/**
 * One-shot pipeline diagnostic.
 *
 * Usage:
 *   npm run diagnose -- <your-login-email>
 *
 * Prints a clear picture of:
 *  - How many emails each stage rejected/accepted
 *  - The exact subjects that got rejected by Stage 1 but look like real jobs
 *  - How many jobs currently exist
 *  - A verdict + concrete next step
 */
import { createServiceClient } from '@/lib/supabase/service'

const RE_LIFECYCLE = /(interview|offer|thank you for applying|application (received|submitted|confirm|update)|unfortunately|not moving forward|next steps|update on your|status of your|we'?d like to|phone screen|technical (interview|screen|assessment)|assessment|coding challenge|take.?home)/i

const ATS_HINT = /(greenhouse\.io|lever\.co|myworkday|workday\.com|taleo|icims|smartrecruiters|ashbyhq|jobvite|bamboohr|teamtailor|recruitee|successfactors|@careers|@talent|@recruit|@hiring)/i

async function main() {
  const email = process.argv[2]
  if (!email) {
    console.error('Usage: npm run diagnose -- <your-login-email>')
    process.exit(1)
  }

  const supabase = createServiceClient()

  const { data: userRow, error: userErr } = await supabase
    .from('app_users')
    .select('id,email,tier')
    .eq('email', email)
    .maybeSingle<{ id: string; email: string; tier: string }>()

  if (userErr || !userRow) {
    console.error(`Could not find user with email ${email}`)
    process.exit(1)
  }

  const userId = userRow.id
  console.log(`\n=== HireCanvas pipeline diagnosis for ${userRow.email} (${userRow.tier}) ===\n`)

  // --- FUNNEL --------------------------------------------------------------
  const { data: all } = await supabase
    .from('processed_emails')
    .select('review_status,candidate_reason,subject,from_address,processed_at')
    .eq('user_id', userId)
    .order('processed_at', { ascending: false })
    .limit(5000)

  const rows = all || []
  const accepted = rows.filter((r) => r.review_status === 'auto_accepted')
  const needsReview = rows.filter((r) => r.review_status === 'needs_review')
  const rejected = rows.filter((r) => r.review_status === 'auto_rejected')
  const unlabeled = rows.filter((r) => !r.review_status)

  console.log('FUNNEL')
  console.log(`  total processed_emails rows : ${rows.length}`)
  console.log(`    auto_accepted             : ${accepted.length}`)
  console.log(`    needs_review              : ${needsReview.length}`)
  console.log(`    auto_rejected             : ${rejected.length}`)
  console.log(`    unlabeled (legacy rows)   : ${unlabeled.length}`)

  // --- JOBS ----------------------------------------------------------------
  const { count: jobCount } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  const { count: gmailSourcedJobs } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('source', 'gmail_sync')

  console.log('\nJOBS TABLE')
  console.log(`  total jobs                  : ${jobCount ?? 0}`)
  console.log(`    from gmail sync           : ${gmailSourcedJobs ?? 0}`)

  // --- REJECTION REASON BREAKDOWN ------------------------------------------
  const byReason = new Map<string, number>()
  for (const r of rejected) {
    const reason = (r.candidate_reason || 'unknown').split(':')[0]
    byReason.set(reason, (byReason.get(reason) || 0) + 1)
  }
  console.log('\nREJECTION REASONS (top-level)')
  for (const [k, v] of [...byReason.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(30)} ${v}`)
  }

  // --- FALSE NEGATIVE CHECK ------------------------------------------------
  const suspectRejections = rejected.filter((r) => {
    const text = `${r.subject || ''} ${r.from_address || ''}`
    return RE_LIFECYCLE.test(r.subject || '') || ATS_HINT.test(r.from_address || '')
  })

  console.log(`\nSUSPECT REJECTIONS (subject looks like a real lifecycle email): ${suspectRejections.length}`)
  for (const r of suspectRejections.slice(0, 30)) {
    console.log(`  [${r.candidate_reason}] ${r.subject}  <-  ${r.from_address}`)
  }

  // --- NEEDS REVIEW SAMPLE -------------------------------------------------
  if (needsReview.length > 0) {
    console.log(`\nNEEDS REVIEW SAMPLE (first 15)`)
    for (const r of needsReview.slice(0, 15)) {
      console.log(`  [${r.candidate_reason}] ${r.subject}  <-  ${r.from_address}`)
    }
  }

  // --- VERDICT -------------------------------------------------------------
  console.log('\n=== VERDICT ===')
  if ((gmailSourcedJobs ?? 0) === 0 && accepted.length === 0) {
    if (suspectRejections.length > 5) {
      console.log('Stage 1 classifier is rejecting real-looking lifecycle emails.')
      console.log('ACTION: switch to high_recall mode and re-sync.')
    } else if (rejected.length > 100) {
      console.log('The classifier correctly rejected most traffic, but nothing got through.')
      console.log('This means your actual application emails may simply not be in the last 90d Gmail window')
      console.log('OR the Gmail fetch query is too narrow.')
      console.log('ACTION: widen the query (high_recall mode removes extra filtering) and re-sync a full range.')
    } else {
      console.log('Very few emails were processed. Gmail fetch returned less than expected.')
      console.log('ACTION: run a custom date range sync covering your real application period.')
    }
  } else {
    console.log(`Pipeline is landing jobs. ${gmailSourcedJobs} in DB, ${accepted.length} accepted recently.`)
  }

  console.log('')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
