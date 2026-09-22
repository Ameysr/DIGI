import {
  PRIZE_POOL_RATE,
  ROLLOVER_TIER,
  TIER_SPLITS,
  type PrizeTier,
} from '@/lib/constants'

/**
 * Prize pool arithmetic. Deliberately pure and integer-based: money is handled
 * in whole cents throughout so a draw can never lose or invent a cent to
 * floating-point drift.
 */

/** Payments collected from active subscribers, plus any jackpot carried in. */
export function computePool(totalPaymentsCents: number, rolloverInCents: number): number {
  return Math.round(totalPaymentsCents * PRIZE_POOL_RATE) + rolloverInCents
}

/**
 * Divide the pool across the three tiers.
 *
 * The two headline tiers floor, and the lowest tier absorbs the remainder so the
 * parts always sum exactly to the pool — naive rounding would silently strand a
 * few cents every month.
 *
 * IMPORTANT: this rule is mirrored verbatim in `publish_draw()` in
 * supabase/migrations. If you change it here, change it there too, or an admin
 * simulation will disagree with the committed result.
 */
export function splitTiers(poolCents: number): Record<PrizeTier, number> {
  const jackpot = Math.floor(poolCents * TIER_SPLITS['5_match'])
  const four = Math.floor(poolCents * TIER_SPLITS['4_match'])
  const three = poolCents - jackpot - four

  return { '5_match': jackpot, '4_match': four, '3_match': three }
}

/**
 * Equal split between winners in the same tier, rounded down. Any leftover cents
 * stay in the pool rather than being handed out unevenly.
 */
export function perWinner(tierCents: number, winnerCount: number): number {
  if (winnerCount <= 0) return 0
  return Math.floor(tierCents / winnerCount)
}

/**
 * The jackpot carries forward when nobody matches five numbers. The lower tiers
 * do not roll: an unclaimed 4- or 3-match pool simply lapses.
 */
export function computeRollover(
  tierCents: number,
  winnerCount: number,
  tier: PrizeTier = ROLLOVER_TIER,
): number {
  if (tier !== ROLLOVER_TIER) return 0
  return winnerCount > 0 ? 0 : tierCents
}
