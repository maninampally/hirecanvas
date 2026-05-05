/**
 * Ad-hoc Supabase queries (service role — full DB access).
 *
 * Setup:
 *   cp scripts/supabase-query.temp.example.ts scripts/supabase-query.temp.ts
 *   # edit queries in supabase-query.temp.ts (gitignored)
 *
 * Run:
 *   npm run supabase:query
 *
 * Raw SQL: use Supabase Dashboard → SQL Editor, or psql with the project DB URL.
 * This script only runs what @supabase/supabase-js exposes (PostgREST), e.g. .from().select().
 */
import { createServiceClient } from '@/lib/supabase/service'

async function main() {
  const supabase = createServiceClient()

  // --- paste / edit queries below -----------------------------------------

  const { data, error } = await supabase.from('app_users').select('id,full_name,tier').limit(5)

  console.log(JSON.stringify({ data, error }, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
