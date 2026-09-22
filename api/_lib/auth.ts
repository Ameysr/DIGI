import { headerValue, type ApiRequest } from './http'
import { supabaseAdmin } from './supabaseAdmin'

/**
 * Verifies the caller's Supabase access token and returns their user id.
 *
 * Supabase validates the token itself: `auth.getUser(jwt)` checks the signature
 * and expiry against the project's own signing keys — which is why this replaced
 * an external verification step and a JWKS fetch, and why there is no provider to
 * configure before it works.
 *
 * Returns null when the request is unauthenticated, and callers must treat null
 * as "deny" — this is the only identity check the API functions rely on, since
 * the service-role client bypasses RLS.
 */
export async function getUserId(req: ApiRequest): Promise<string | null> {
  const header = headerValue(req, 'authorization')
  if (!header?.startsWith('Bearer ')) return null

  const token = header.slice('Bearer '.length).trim()
  if (!token) return null

  try {
    const { data, error } = await supabaseAdmin().auth.getUser(token)
    if (error) return null
    return data.user?.id ?? null
  } catch {
    // A malformed or expired token is an unauthenticated request, not a crash.
    return null
  }
}
