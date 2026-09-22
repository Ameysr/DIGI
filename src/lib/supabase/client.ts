import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'

/**
 * Supabase client backed by Supabase Auth.
 *
 * An earlier version used an external identity provider, which meant fetching a
 * token from a third party, handing it to Supabase, and configuring that provider
 * in the dashboard before any policy would match. Identity now comes from
 * Supabase itself, so there is nothing to bridge: supabase-js persists the
 * session, refreshes it, and attaches the access token to every request.
 *
 * The JWT `sub` claim is populated natively, which is exactly what
 * `auth_user_id()` already reads inside the RLS policies — so the policy layer
 * needed no changes at all.
 */
export const supabase: SupabaseClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'digital-heroes-auth',
  },
})

/** Public URL for a file in the public `charity-media` bucket. */
export function charityMediaUrl(path: string): string {
  return `${env.supabaseUrl}/storage/v1/object/public/charity-media/${path}`
}

/**
 * The current access token, for calling our own `/api` functions.
 *
 * The browser does not need this for Supabase itself — supabase-js attaches the
 * token automatically — but the serverless functions verify the caller
 * independently, so they need it in an Authorization header.
 */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}
