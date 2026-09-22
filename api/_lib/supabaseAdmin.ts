import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { serverEnv } from './env'

let cached: SupabaseClient | null = null

/**
 * Service-role Supabase client.
 *
 * This key bypasses Row Level Security completely, so it must never leave the
 * server. It is used only by the webhook and cron functions, which are
 * authenticated by provider signature or shared secret instead.
 */
export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached
  const { supabaseUrl, supabaseServiceRoleKey } = serverEnv()
  cached = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cached
}
