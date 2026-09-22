import { describe, expect, it } from 'vitest'
import { errorMessage, isDuplicate } from './errors'

/**
 * These two helpers exist because of a real failure: a foreign-key violation
 * surfaced to a paying customer as "Payment verification failed.", and the cause
 * was invisible in the logs.
 *
 * Supabase's PostgrestError is a plain object, not an Error subclass, so the
 * instinctive `error instanceof Error ? error.message : 'generic'` discards the
 * only useful information for every database error. That regression is pinned
 * here.
 */
describe('errorMessage', () => {
  it('uses the message of a real Error', () => {
    expect(errorMessage(new Error('connection reset'))).toBe('connection reset')
  })

  it('handles a PostgrestError, which is NOT an Error instance', () => {
    // The exact shape supabase-js returns. `instanceof Error` is false for it.
    const postgrestError = {
      message: 'insert or update on table "charity_contributions" violates foreign key constraint',
      details: 'Key (user_id)=(user_x) is not present in table "profiles".',
      hint: null,
      code: '23503',
    }

    expect(postgrestError instanceof Error).toBe(false)
    expect(errorMessage(postgrestError)).toContain('violates foreign key constraint')
  })

  it('handles the Razorpay SDK shape', () => {
    const razorpayError = {
      statusCode: 401,
      error: { code: 'BAD_REQUEST_ERROR', description: 'Authentication failed' },
    }
    expect(errorMessage(razorpayError)).toBe('Authentication failed')
  })

  it('prefers a Razorpay description over a generic message field', () => {
    expect(errorMessage({ message: 'Request failed', error: { description: 'Specific reason' } })).toBe(
      'Specific reason',
    )
  })

  it('falls back to a description field directly', () => {
    expect(errorMessage({ description: 'Something specific' })).toBe('Something specific')
  })

  it('never returns an empty or placeholder string', () => {
    expect(errorMessage(null)).toBe('Unknown error')
    expect(errorMessage(undefined)).toBe('Unknown error')
    expect(errorMessage({})).toBe('Unknown error')
    expect(errorMessage(new Error(''))).toBe('Unknown error')
    expect(errorMessage('a bare string')).toBe('Unknown error')
  })
})

describe('isDuplicate', () => {
  it('recognises a unique-violation', () => {
    expect(isDuplicate({ code: '23505', message: 'duplicate key value' })).toBe(true)
  })

  it('does not treat other database errors as duplicates', () => {
    // 23503 is the foreign-key violation that caused the original incident — it
    // must NOT be swallowed as a duplicate.
    expect(isDuplicate({ code: '23503', message: 'violates foreign key constraint' })).toBe(false)
    expect(isDuplicate({ code: '42501' })).toBe(false)
  })

  it('tolerates a missing error', () => {
    expect(isDuplicate(null)).toBe(false)
    expect(isDuplicate(undefined)).toBe(false)
    expect(isDuplicate(new Error('nope'))).toBe(false)
  })
})
