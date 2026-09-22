import { supabaseAdmin } from './supabaseAdmin'

/**
 * Guarantees a `profiles` row exists for a signed-in user.
 *
 * Normally the `on_auth_user_created` trigger handles this at signup, so this is
 * belt-and-braces for what the trigger cannot cover: an account created before
 * the trigger existed, or a profile removed by hand.
 *
 * It exists because `subscriptions`, `scores`, `draw_entries` and
 * `charity_contributions` all carry a foreign key to `profiles`, and a missing row
 * there once became a foreign-key violation *after the customer had already been
 * charged*. The server should never depend on someone else having created a row
 * it needs.
 *
 * Idempotent and cheap: one select, and an insert only when absent.
 */
export async function ensureProfile(userId: string): Promise<void> {
  const admin = supabaseAdmin()

  const { data: existing } = await admin.from('profiles').select('id').eq('id', userId).maybeSingle()
  if (existing) return

  // Read the account from Supabase Auth so the row carries a real email and name.
  const { data } = await admin.auth.admin.getUserById(userId)
  const account = data?.user
  const metadata = account?.user_metadata ?? {}

  const fullName =
    typeof metadata.full_name === 'string'
      ? metadata.full_name
      : typeof metadata.name === 'string'
        ? metadata.name
        : null

  const { error } = await admin.from('profiles').insert({
    id: userId,
    email: account?.email ?? '',
    full_name: fullName,
  })

  // 23505 means a concurrent request created it first, which is fine.
  if (error && error.code !== '23505') throw error
}
