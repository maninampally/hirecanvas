import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Resolve auth user id by email (case-insensitive) via the Admin API.
 * Requires a service-role client. Paginates until a match or the user list ends.
 */
export async function findAuthUserIdByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<string | null> {
  const needle = email.trim().toLowerCase()
  if (!needle) return null

  let page = 1
  const perPage = 1000

  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) {
      console.error('[findAuthUserIdByEmail]', error.message)
      return null
    }

    const users = data?.users ?? []
    const hit = users.find((u) => (u.email || '').toLowerCase() === needle)
    if (hit) return hit.id

    if (users.length < perPage) break
    page += 1
  }

  return null
}
