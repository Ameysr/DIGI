/**
 * Row shapes for the Supabase tables, mirroring supabase/migrations.
 *
 * These are hand-written rather than generated so they stay readable; if the
 * schema changes, change these alongside it. Timestamps arrive as ISO strings
 * over PostgREST.
 */
import type { DrawStatus, DrawType, PlanId, PrizeTier } from './constants'

export type UserRole = 'subscriber' | 'admin'
export type SubStatus = 'inactive' | 'active' | 'past_due' | 'cancelled' | 'lapsed'
export type ReviewStatus = 'pending' | 'approved' | 'rejected'
export type PaymentStatus = 'pending' | 'paid'

export type Profile = {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  charity_id: string | null
  charity_percentage: number
  created_at: string
  updated_at: string
}

export type Subscription = {
  id: string
  user_id: string
  /** Payment gateway the subscription came from. Razorpay today. */
  provider: string
  plan: PlanId
  status: SubStatus
  /** Smallest currency unit — paise for INR. */
  amount_cents: number
  provider_customer_id: string | null
  provider_subscription_id: string | null
  current_period_start: string | null
  current_period_end: string | null
  /** Cancelled, but still inside the paid period. */
  cancel_at_period_end: boolean
  created_at: string
  updated_at: string
}

export type Score = {
  id: string
  user_id: string
  value: number
  played_on: string
  created_at: string
}

export type Charity = {
  id: string
  slug: string
  name: string
  short_blurb: string
  description: string
  image_url: string | null
  logo_url: string | null
  website_url: string | null
  is_featured: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export type CharityEvent = {
  id: string
  charity_id: string
  title: string
  description: string
  starts_at: string
  location: string | null
  created_at: string
}

export type ContributionSource = 'subscription' | 'donation'

export type CharityContribution = {
  id: string
  user_id: string
  charity_id: string | null
  /** Null for independent donations, which have no subscription behind them. */
  subscription_id: string | null
  amount_cents: number
  period_month: string
  /** Which route produced this contribution. */
  source: ContributionSource
  /** The gateway's payment id. Unique, so retries cannot double-credit. */
  provider_payment_id: string | null
  created_at: string
}

export type Draw = {
  id: string
  draw_month: string
  draw_type: DrawType
  status: DrawStatus
  winning_numbers: number[] | null
  subscriber_count: number
  total_pool_cents: number
  rollover_in_cents: number
  rollover_out_cents: number
  published_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type DrawEntry = {
  id: string
  draw_id: string
  user_id: string
  numbers: number[]
  matched_count: number
  prize_tier: PrizeTier | null
  prize_cents: number
  created_at: string
}

export type Winner = {
  id: string
  draw_id: string
  user_id: string
  draw_entry_id: string | null
  prize_tier: PrizeTier
  prize_cents: number
  proof_path: string | null
  review_status: ReviewStatus
  payment_status: PaymentStatus
  rejection_reason: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  paid_at: string | null
  created_at: string
  updated_at: string
}

/** A draw entry joined with the draw it belongs to, for the user's history. */
export type DrawEntryWithDraw = DrawEntry & { draws: Draw }

/** A winner claim joined with its draw, for the winnings screen. */
export type WinnerWithDraw = Winner & { draws: Draw }

/** Winner plus the claimholder's profile, for the admin review queue. */
export type WinnerWithProfile = Winner & {
  draws: Draw
  profiles: Pick<Profile, 'full_name' | 'email'> | null
}

export type SubscriptionWithProfile = Subscription & {
  profiles: Pick<Profile, 'full_name' | 'email'> | null
}
