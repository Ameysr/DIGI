import type { SubStatus, Subscription } from './types'

export type SubscriptionState = {
  subscription: Subscription | null
  /** The effective status, after accounting for an elapsed paid period. */
  status: SubStatus
  /** Whether the user currently has access. */
  isActive: boolean
  /** The paid period has run out; paying again is required. */
  hasLapsed: boolean
}

export const NO_SUBSCRIPTION: SubscriptionState = {
  subscription: null,
  status: 'inactive',
  isActive: false,
  hasLapsed: false,
}

/**
 * Derives the effective subscription state from a row and a point in time.
 *
 * Payments are taken as one-off orders, so nothing renews automatically and the
 * stored status is not the whole truth on its own: a row can still say `active`
 * after the period it paid for has run out. This is where that is reconciled,
 * which is what gives us the PRD's "lapsed" state without a scheduled job.
 *
 * Deliberately a pure function taking the clock as an argument, so it can be
 * tested at any point in time and never has to read the clock during render.
 */
export function applyPeriod(subscription: Subscription | null, now: Date): SubscriptionState {
  if (!subscription) return NO_SUBSCRIPTION

  const stored: SubStatus = subscription.status
  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end).getTime()
    : null
  const periodEnded = periodEnd !== null && periodEnd <= now.getTime()

  // A cancelled subscription keeps working until the period it already paid for
  // runs out; once that passes it is lapsed, whichever way it got there.
  const wasPaying = stored === 'active' || stored === 'cancelled'
  const status: SubStatus = periodEnded && wasPaying ? 'lapsed' : stored

  return {
    subscription,
    status,
    isActive: wasPaying && !periodEnded,
    hasLapsed: status === 'lapsed',
  }
}
