/**
 * Reads an authentication error that Supabase appends to the redirect URL.
 *
 * When an email link is expired or already used, Supabase sends the browser back
 * to the app with the failure in the **hash**, not the query string:
 *
 *   /#error=access_denied&error_code=otp_expired&error_description=...
 *
 * `supabase-js` only looks for tokens in the hash, so an error is silently
 * ignored — the user lands on a normal-looking page with no indication of what
 * happened, and the raw error sits in the address bar. This is the parser that
 * turns it into something readable.
 */

export type AuthLinkError = {
  /** Supabase's machine-readable code, when present. */
  code: string | null
  /** A plain-language explanation. */
  message: string
  /** The raw description from Supabase, for the technical detail. */
  detail: string
  /** What the reader should do next. */
  advice: string
}

function explain(code: string | null): { message: string; advice: string } {
  switch (code) {
    case 'otp_expired':
      return {
        message: 'That link has expired, or has already been used.',
        advice:
          'Confirmation links can only be used once, and they expire. Sign in, or sign up again to get a fresh one.',
      }
    case 'access_denied':
      return {
        message: 'That link could not be used.',
        advice: 'Sign in, or sign up again to get a fresh link.',
      }
    default:
      return {
        message: 'The sign-in link could not be used.',
        advice: 'Sign in, or sign up again to get a fresh link.',
      }
  }
}

export function readAuthLinkError(hash: string): AuthLinkError | null {
  const cleaned = hash.startsWith('#') ? hash.slice(1) : hash
  if (!cleaned) return null

  const params = new URLSearchParams(cleaned)
  if (!params.get('error')) return null

  const code = params.get('error_code')
  const detail = (params.get('error_description') ?? '').replace(/\+/g, ' ')
  const { message, advice } = explain(code)

  return { code, message, detail, advice }
}
