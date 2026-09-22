import { describe, expect, it } from 'vitest'
import { readAuthLinkError } from './linkError'

/**
 * Supabase reports a failed email link by appending the error to the redirect
 * URL's hash. `supabase-js` only looks there for tokens, so without this parser
 * the error is dropped and the user sees a normal page with a broken URL.
 *
 * These pin the exact payload that arrived from a real deployment.
 */
describe('readAuthLinkError', () => {
  it('parses the expired-link error from a real redirect', () => {
    const error = readAuthLinkError(
      '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&sb=',
    )

    expect(error).not.toBeNull()
    expect(error?.code).toBe('otp_expired')
    expect(error?.message).toContain('expired')
    expect(error?.detail).toBe('Email link is invalid or has expired')
  })

  it('works without the leading hash', () => {
    const error = readAuthLinkError('error=access_denied&error_code=otp_expired')
    expect(error?.code).toBe('otp_expired')
  })

  it('returns null when there is no error, so a normal load is unaffected', () => {
    expect(readAuthLinkError('')).toBeNull()
    expect(readAuthLinkError('#')).toBeNull()
    expect(readAuthLinkError('#access_token=abc&type=recovery')).toBeNull()
  })

  it('explains an unrecognised code rather than showing nothing', () => {
    const error = readAuthLinkError('#error=server_error&error_code=something_new')
    expect(error).not.toBeNull()
    expect(error?.message).toBeTruthy()
    expect(error?.advice).toBeTruthy()
  })

  it('still parses an error that carries no code', () => {
    const error = readAuthLinkError('#error=access_denied')
    expect(error).not.toBeNull()
    expect(error?.code).toBeNull()
  })
})
