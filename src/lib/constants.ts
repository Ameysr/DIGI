/**
 * Domain constants — the single source of truth for every number the platform
 * treats as a business rule. Both the UI and the Postgres `publish_draw`
 * function mirror these values; change them here first.
 */

/* -------------------------------------------------------------------------- */
/* Pricing                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Billing currency.
 *
 * Amounts across this codebase — here, in the database, and in the API — are
 * always integers in the smallest unit of this currency, never decimals. For INR
 * that unit is paise, which behaves exactly as cents do for USD, so the
 * `_CENTS` naming is kept throughout.
 */
export const CURRENCY = 'INR'
export const CURRENCY_LOCALE = 'en-IN'

/** Smallest currency unit: 49900 paise = ₹499. */
export const PRICE_MONTHLY_CENTS = 49900
export const PRICE_YEARLY_CENTS = 499900

export type PlanId = 'monthly' | 'yearly'

export type Plan = {
  id: PlanId
  label: string
  priceCents: number
  cadence: string
  blurb: string
  /** The plan to nudge users towards. */
  highlight?: boolean
}

export const PLANS: Plan[] = [
  {
    id: 'monthly',
    label: 'Monthly',
    priceCents: PRICE_MONTHLY_CENTS,
    cadence: 'per month',
    blurb: 'Rolling monthly entry, cancel any time.',
  },
  {
    id: 'yearly',
    label: 'Yearly',
    priceCents: PRICE_YEARLY_CENTS,
    cadence: 'per year',
    blurb: 'Two months free versus paying monthly.',
    highlight: true,
  },
]

/** Whole-percent saving the yearly plan represents against 12 monthly payments. */
export const YEARLY_SAVING_PERCENT = Math.round(
  (1 - PRICE_YEARLY_CENTS / (PRICE_MONTHLY_CENTS * 12)) * 100,
)

/* -------------------------------------------------------------------------- */
/* Prize pool                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Share of every subscription payment that funds the prize pool. The remainder
 * is split between the subscriber's chosen charity and the platform.
 */
export const PRIZE_POOL_RATE = 0.5

export const PRIZE_TIERS = ['5_match', '4_match', '3_match'] as const
export type PrizeTier = (typeof PRIZE_TIERS)[number]

/** How the pool is divided between tiers. Must sum to 1. */
export const TIER_SPLITS: Record<PrizeTier, number> = {
  '5_match': 0.4,
  '4_match': 0.35,
  '3_match': 0.25,
}

export const TIER_LABELS: Record<PrizeTier, string> = {
  '5_match': '5-number match',
  '4_match': '4-number match',
  '3_match': '3-number match',
}

/** Only the jackpot tier carries forward when nobody wins it. */
export const ROLLOVER_TIER: PrizeTier = '5_match'

/* -------------------------------------------------------------------------- */
/* Charity                                                                     */
/* -------------------------------------------------------------------------- */

export const CHARITY_PERCENTAGE_MIN = 10
export const CHARITY_PERCENTAGE_MAX = 50
export const CHARITY_PERCENTAGE_DEFAULT = 10

/* -------------------------------------------------------------------------- */
/* Independent donations                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Bounds and presets for a one-off donation, in paise.
 *
 * MIRRORS `DONATION_MIN_PAISE` / `DONATION_MAX_PAISE` in api/_lib/pricing.ts.
 * The server re-validates them — these copies exist so the form can give
 * immediate feedback rather than waiting for a round trip to reject it.
 */
export const DONATION_MIN_CENTS = 10_000 // ₹100
export const DONATION_MAX_CENTS = 10_000_000 // ₹1,00,000
export const DONATION_PRESETS_CENTS = [50_000, 100_000, 250_000] // ₹500 / ₹1,000 / ₹2,500

/* -------------------------------------------------------------------------- */
/* Scoring                                                                     */
/* -------------------------------------------------------------------------- */

export const SCORE_MIN = 1
export const SCORE_MAX = 45
/** Only the latest five scores are retained; a sixth entry prunes the oldest. */
export const SCORE_LIMIT = 5

/* -------------------------------------------------------------------------- */
/* Draws                                                                       */
/* -------------------------------------------------------------------------- */

export const DRAW_NUMBER_COUNT = 5
export const DRAW_NUMBER_MIN = 1
export const DRAW_NUMBER_MAX = 45
/** A subscriber must hold a full set of scores before they can be entered. */
export const DRAW_ELIGIBLE_SCORE_COUNT = SCORE_LIMIT

export const DRAW_TYPES = ['random', 'algorithmic'] as const
export type DrawType = (typeof DRAW_TYPES)[number]

export const DRAW_TYPE_LABELS: Record<DrawType, string> = {
  random: 'Random',
  algorithmic: 'Algorithmic (score weighted)',
}

export const DRAW_STATUSES = ['draft', 'simulated', 'published'] as const
export type DrawStatus = (typeof DRAW_STATUSES)[number]
