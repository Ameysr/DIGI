import { describe, expect, it } from 'vitest'
import { describeDbError, errorText, isSessionRejected } from './errors'

/**
 * These mappings are the bridge between database constraints and what a
 * subscriber reads on screen. The database is what enforces the rules, so its
 * errors are the ones users actually hit — if a code is missing here they get a
 * raw Postgres message instead of an explanation.
 */
describe('describeDbError', () => {
  it('explains a duplicate score date in terms the user can act on', () => {
    const message = describeDbError({ code: '23505', message: 'duplicate key value' })
    expect(message).toContain('already logged a score for that date')
    expect(message).not.toContain('duplicate key value')
  })

  it('explains a check constraint violation as a range problem', () => {
    expect(describeDbError({ code: '23514' })).toContain('between 1 and 45')
  })

  it('explains a future-dated score', () => {
    expect(describeDbError({ code: '22007' })).toContain('cannot be dated in the future')
  })

  it('explains a permission failure without leaking SQL detail', () => {
    const message = describeDbError({ code: '42501', message: 'new row violates row-level security' })
    expect(message).toBe('You do not have permission to do that.')
  })

  it('falls back to the database message for an unmapped code', () => {
    expect(describeDbError({ code: 'XX000', message: 'something specific' })).toBe(
      'something specific',
    )
  })

  it('always returns something usable, even for a non-error value', () => {
    expect(describeDbError(null)).toBe('Something went wrong. Please try again.')
    expect(describeDbError(undefined)).toBe('Something went wrong. Please try again.')
    expect(describeDbError('a string')).toBe('Something went wrong. Please try again.')
  })
})

/**
 * These pin a real regression. Supabase returned PGRST301 / "No suitable key or
 * wrong key type" for a token it could not decode, the check did not recognise
 * it, and the failure fell through to the UI as "you have no subscription" — for
 * a user who was, in fact, subscribed. A silent misreport is worse than an error.
 */
describe('isSessionRejected', () => {
  it('recognises an RLS denial', () => {
    expect(isSessionRejected({ code: '42501', message: 'permission denied for table profiles' })).toBe(true)
  })

  it('recognises an undecodable token (PGRST301)', () => {
    const undecodable = {
      code: 'PGRST301',
      details: 'No suitable key was found to decode the JWT',
      hint: null,
      message: 'No suitable key or wrong key type',
    }
    // Note the absence of a `status` field — this is why a status-based check
    // missed it entirely.
    expect('status' in undecodable).toBe(false)
    expect(isSessionRejected(undecodable)).toBe(true)
  })

  it('recognises the messages without relying on the code', () => {
    expect(isSessionRejected({ message: 'No suitable key or wrong key type' })).toBe(true)
    expect(isSessionRejected({ message: 'JWT verification failed' })).toBe(true)
    expect(isSessionRejected({ message: 'Invalid JWT' })).toBe(true)
  })

  it('recognises a transport-level status', () => {
    expect(isSessionRejected({ status: 401 })).toBe(true)
    expect(isSessionRejected({ status: 403 })).toBe(true)
  })

  it('does NOT treat an unrelated failure as a session problem', () => {
    // A foreign key violation is a data problem. Reporting it as an auth problem
    // would send the reader to the wrong dashboard.
    expect(
      isSessionRejected({ code: '23503', message: 'violates foreign key constraint' }),
    ).toBe(false)
    expect(isSessionRejected({ code: '23505', message: 'duplicate key value' })).toBe(false)
    expect(isSessionRejected(null)).toBe(false)
    expect(isSessionRejected(undefined)).toBe(false)
  })
})

describe('errorText', () => {
  it('reads a PostgrestError, which is not an Error instance', () => {
    const postgrestError = { message: 'relation does not exist', code: '42P01' }
    expect(postgrestError instanceof Error).toBe(false)
    expect(errorText(postgrestError)).toBe('relation does not exist')
  })

  it('reads the Razorpay shape', () => {
    expect(errorText({ error: { description: 'Authentication failed' } })).toBe('Authentication failed')
  })

  it('returns an empty string rather than throwing on an unknown shape', () => {
    expect(errorText(null)).toBe('')
    expect(errorText(undefined)).toBe('')
    expect(errorText({})).toBe('')
  })
})
