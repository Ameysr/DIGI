import crypto from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  mapStatus,
  periodMonthFrom,
  safeEqual,
  toIso,
  verifyPaymentSignature,
  verifyWebhookSignature,
} from './razorpay'

describe('mapStatus', () => {
  it('treats only an active subscription as active', () => {
    expect(mapStatus('active')).toBe('active')
  })

  it('does not treat a registered mandate as active', () => {
    // `authenticated` means the mandate exists but nothing has been charged.
    // Calling it active would enter someone into a draw before they had paid.
    expect(mapStatus('authenticated')).toBe('inactive')
    expect(mapStatus('created')).toBe('inactive')
  })

  it('maps interrupted collection to past_due', () => {
    expect(mapStatus('pending')).toBe('past_due')
    expect(mapStatus('halted')).toBe('past_due')
    expect(mapStatus('paused')).toBe('past_due')
  })

  it('maps the terminal states', () => {
    expect(mapStatus('cancelled')).toBe('cancelled')
    expect(mapStatus('completed')).toBe('lapsed')
    expect(mapStatus('expired')).toBe('lapsed')
  })

  it('falls back to inactive for anything unrecognised', () => {
    expect(mapStatus('something-new')).toBe('inactive')
    expect(mapStatus(undefined)).toBe('inactive')
  })
})

describe('toIso', () => {
  it('converts Unix seconds to an ISO string', () => {
    expect(toIso(1_800_000_000)).toBe(new Date(1_800_000_000 * 1000).toISOString())
  })

  it('returns null when Razorpay omits the field', () => {
    expect(toIso(0)).toBeNull()
    expect(toIso(null)).toBeNull()
    expect(toIso(undefined)).toBeNull()
  })
})

describe('periodMonthFrom', () => {
  it('returns the first day of the month a payment belongs to', () => {
    expect(periodMonthFrom(new Date('2026-09-21T13:45:00.000Z'))).toBe('2026-09-01')
  })

  it('does not drift back a month on the first', () => {
    expect(periodMonthFrom(new Date('2026-01-01T00:00:00.000Z'))).toBe('2026-01-01')
  })
})

describe('safeEqual', () => {
  it('accepts identical strings', () => {
    expect(safeEqual('abc123', 'abc123')).toBe(true)
  })

  it('rejects different strings of the same length', () => {
    expect(safeEqual('abc123', 'abc124')).toBe(false)
  })

  it('rejects length mismatches without throwing', () => {
    // timingSafeEqual throws on mismatched lengths, so length is checked first.
    expect(() => safeEqual('abc', 'abcd')).not.toThrow()
    expect(safeEqual('abc', 'abcd')).toBe(false)
    expect(safeEqual('abc', '')).toBe(false)
  })
})

describe('verifyWebhookSignature', () => {
  const secret = 'test_webhook_secret'
  const body = Buffer.from(JSON.stringify({ event: 'subscription.charged', id: 'sub_123' }))
  const sign = (payload: Buffer, withSecret = secret) =>
    crypto.createHmac('sha256', withSecret).update(payload).digest('hex')

  it('accepts a signature computed with the same secret', () => {
    expect(verifyWebhookSignature(body, sign(body), secret)).toBe(true)
  })

  it('rejects a signature made with a different secret', () => {
    expect(verifyWebhookSignature(body, sign(body, 'the-wrong-secret'), secret)).toBe(false)
  })

  it('rejects a tampered body, which is the whole point of the check', () => {
    const signature = sign(body)
    const tampered = Buffer.from(
      JSON.stringify({ event: 'subscription.charged', id: 'sub_EVIL' }),
    )
    expect(verifyWebhookSignature(tampered, signature, secret)).toBe(false)
  })

  it('rejects a missing signature rather than throwing', () => {
    expect(verifyWebhookSignature(body, null, secret)).toBe(false)
    expect(verifyWebhookSignature(body, '', secret)).toBe(false)
    expect(verifyWebhookSignature(body, undefined, secret)).toBe(false)
  })

  it('rejects a wrong-length signature without throwing', () => {
    expect(() => verifyWebhookSignature(body, 'abc', secret)).not.toThrow()
    expect(verifyWebhookSignature(body, 'abc', secret)).toBe(false)
  })
})

describe('verifyPaymentSignature', () => {
  const secret = 'test_key_secret'
  const orderId = 'order_ABC123'
  const paymentId = 'pay_XYZ789'

  /** What Razorpay itself computes and hands to the browser. */
  const sign = (order: string, payment: string, withSecret = secret) =>
    crypto.createHmac('sha256', withSecret).update(`${order}|${payment}`).digest('hex')

  const valid = { orderId, paymentId, signature: sign(orderId, paymentId), secret }

  it('accepts a genuine payment signature', () => {
    expect(verifyPaymentSignature(valid)).toBe(true)
  })

  it('rejects a signature made with the wrong secret', () => {
    expect(
      verifyPaymentSignature({ ...valid, signature: sign(orderId, paymentId, 'wrong-secret') }),
    ).toBe(false)
  })

  it('rejects a signature for a different payment id', () => {
    // The attack that matters: swapping in your own payment id while keeping
    // someone else's order id.
    expect(
      verifyPaymentSignature({ ...valid, signature: sign(orderId, 'pay_SOMEONE_ELSE') }),
    ).toBe(false)
  })

  it('rejects a signature for a different order', () => {
    expect(
      verifyPaymentSignature({ ...valid, signature: sign('order_SOMEONE_ELSE', paymentId) }),
    ).toBe(false)
  })

  it('rejects missing fields rather than throwing', () => {
    expect(verifyPaymentSignature({ ...valid, signature: '' })).toBe(false)
    expect(verifyPaymentSignature({ ...valid, orderId: '' })).toBe(false)
    expect(verifyPaymentSignature({ ...valid, paymentId: '' })).toBe(false)
  })

  it('rejects a truncated signature without throwing', () => {
    expect(() => verifyPaymentSignature({ ...valid, signature: 'abc' })).not.toThrow()
    expect(verifyPaymentSignature({ ...valid, signature: 'abc' })).toBe(false)
  })
})
