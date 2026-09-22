import { describe, expect, it } from 'vitest'
import { applyPeriod } from './subscription-state'
import type { Subscription } from './types'

const NOW = new Date('2026-06-15T12:00:00.000Z')

function subscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'sub-1',
    user_id: 'user_1',
    provider: 'razorpay',
    plan: 'monthly',
    status: 'active',
    amount_cents: 49900,
    provider_customer_id: null,
    provider_subscription_id: 'order_ABC',
    current_period_start: '2026-06-01T12:00:00.000Z',
    current_period_end: '2026-07-01T12:00:00.000Z',
    cancel_at_period_end: false,
    created_at: '2026-06-01T12:00:00.000Z',
    updated_at: '2026-06-01T12:00:00.000Z',
    ...overrides,
  }
}

describe('applyPeriod', () => {
  it('treats a payment inside its period as active', () => {
    const state = applyPeriod(subscription(), NOW)
    expect(state.status).toBe('active')
    expect(state.isActive).toBe(true)
    expect(state.hasLapsed).toBe(false)
  })

  it('treats an elapsed period as lapsed even though the row still says active', () => {
    // Nothing renews automatically, so this is the case that matters: the stored
    // status is stale and access must be refused anyway.
    const state = applyPeriod(
      subscription({ current_period_end: '2026-06-01T12:00:00.000Z' }),
      NOW,
    )
    expect(state.status).toBe('lapsed')
    expect(state.isActive).toBe(false)
    expect(state.hasLapsed).toBe(true)
  })

  it('treats the exact moment of expiry as ended', () => {
    const state = applyPeriod(
      subscription({ current_period_end: NOW.toISOString() }),
      NOW,
    )
    expect(state.isActive).toBe(false)
    expect(state.status).toBe('lapsed')
  })

  it('keeps access for a cancelled subscription until the period ends', () => {
    // Cancelling records intent; it does not confiscate what was paid for.
    const state = applyPeriod(
      subscription({ status: 'cancelled', cancel_at_period_end: true }),
      NOW,
    )
    expect(state.isActive).toBe(true)
    expect(state.status).toBe('cancelled')
  })

  it('lapses a cancelled subscription once the period ends', () => {
    const state = applyPeriod(
      subscription({
        status: 'cancelled',
        cancel_at_period_end: true,
        current_period_end: '2026-06-01T12:00:00.000Z',
      }),
      NOW,
    )
    expect(state.isActive).toBe(false)
    expect(state.status).toBe('lapsed')
  })

  it('does not grant access for a pending order that was never paid', () => {
    const state = applyPeriod(subscription({ status: 'inactive' }), NOW)
    expect(state.isActive).toBe(false)
    expect(state.status).toBe('inactive')
    expect(state.hasLapsed).toBe(false)
  })

  it('falls back to the stored status when no period is recorded', () => {
    // There is nothing to date, so the status is the only signal available.
    // Every real row gets both period fields from verify-payment, so this is a
    // defensive path rather than an expected one.
    const state = applyPeriod(subscription({ current_period_end: null }), NOW)
    expect(state.isActive).toBe(true)
    expect(state.hasLapsed).toBe(false)
  })

  it('handles having no subscription at all', () => {
    const state = applyPeriod(null, NOW)
    expect(state.subscription).toBeNull()
    expect(state.status).toBe('inactive')
    expect(state.isActive).toBe(false)
  })
})
