import { Badge } from '@/components/ui/badge'
import { TIER_LABELS, type PrizeTier } from '@/lib/constants'
import type { PaymentStatus, ReviewStatus, SubStatus } from '@/lib/types'

/**
 * Status colours in one place, so "active" is never green on one screen and
 * grey on another.
 */
const SUBSCRIPTION_TONES: Record<SubStatus, { tone: 'accent' | 'gold' | 'danger' | 'muted'; label: string }> = {
  active: { tone: 'accent', label: 'Active' },
  inactive: { tone: 'muted', label: 'Inactive' },
  past_due: { tone: 'gold', label: 'Past due' },
  cancelled: { tone: 'danger', label: 'Cancelled' },
  lapsed: { tone: 'danger', label: 'Lapsed' },
}

export function SubscriptionBadge({ status }: { status: SubStatus }) {
  const { tone, label } = SUBSCRIPTION_TONES[status]
  return <Badge tone={tone}>{label}</Badge>
}

const REVIEW_TONES: Record<ReviewStatus, { tone: 'gold' | 'accent' | 'danger'; label: string }> = {
  pending: { tone: 'gold', label: 'Pending review' },
  approved: { tone: 'accent', label: 'Approved' },
  rejected: { tone: 'danger', label: 'Rejected' },
}

export function ReviewBadge({ status }: { status: ReviewStatus }) {
  const { tone, label } = REVIEW_TONES[status]
  return <Badge tone={tone}>{label}</Badge>
}

const PAYMENT_TONES: Record<PaymentStatus, { tone: 'gold' | 'accent'; label: string }> = {
  pending: { tone: 'gold', label: 'Payment pending' },
  paid: { tone: 'accent', label: 'Paid' },
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const { tone, label } = PAYMENT_TONES[status]
  return <Badge tone={tone}>{label}</Badge>
}

const TIER_TONES: Record<PrizeTier, 'gold' | 'accent' | 'neutral'> = {
  '5_match': 'gold',
  '4_match': 'accent',
  '3_match': 'neutral',
}

export function TierBadge({ tier }: { tier: PrizeTier }) {
  return <Badge tone={TIER_TONES[tier]}>{TIER_LABELS[tier]}</Badge>
}
