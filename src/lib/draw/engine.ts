import {
  DRAW_NUMBER_COUNT,
  DRAW_NUMBER_MAX,
  DRAW_NUMBER_MIN,
  type DrawType,
  type PrizeTier,
} from '@/lib/constants'
import { range } from '@/lib/utils'
import { countMatches, tierForMatches } from './match'
import { computePool, computeRollover, perWinner, splitTiers } from './prizePool'

/** Returns a float in [0, 1). Injectable so draws can be replayed in tests. */
export type RandomSource = () => number

const UINT32_CEILING = 0x1_0000_0000

/**
 * Cryptographic randomness. `Math.random` is not acceptable for a draw that
 * decides real payouts — its output is predictable from prior values.
 */
export function cryptoRng(): number {
  const buffer = new Uint32Array(1)
  crypto.getRandomValues(buffer)
  return buffer[0] / UINT32_CEILING
}

/**
 * Standard lottery draw: five distinct numbers from 1–45, each equally likely.
 * Partial Fisher–Yates over a full 1–45 pool means no rejection loop and a
 * uniform distribution by construction.
 */
export function drawRandom(rng: RandomSource = cryptoRng): number[] {
  const pool = range(DRAW_NUMBER_MIN, DRAW_NUMBER_MAX)

  for (let i = 0; i < DRAW_NUMBER_COUNT; i += 1) {
    const offset = Math.floor(rng() * (pool.length - i))
    // Clamp guards against a rogue source returning exactly 1.
    const j = Math.min(pool.length - 1, i + offset)
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }

  return pool.slice(0, DRAW_NUMBER_COUNT).sort((a, b) => a - b)
}

/** Tally how often each score value appears across every eligible player. */
export function frequencyFromEntries(entries: number[][]): Map<number, number> {
  const frequency = new Map<number, number>()
  for (const numbers of entries) {
    for (const value of numbers) {
      frequency.set(value, (frequency.get(value) ?? 0) + 1)
    }
  }
  return frequency
}

/**
 * Every number keeps at least this much weight. Without a floor, numbers nobody
 * scored would be unreachable and the draw would become deterministic — the
 * requirement asks for weighting, not for a closed set.
 */
export const ALGORITHMIC_FLOOR_WEIGHT = 1

/**
 * Algorithmic draw: weighted sampling without replacement, where a number's
 * weight is how frequently it was scored across the eligible pool. Common scores
 * come up more often, but all 45 numbers remain possible.
 */
export function drawAlgorithmic(
  frequency: Map<number, number>,
  rng: RandomSource = cryptoRng,
): number[] {
  const weights = new Map<number, number>()
  for (const value of range(DRAW_NUMBER_MIN, DRAW_NUMBER_MAX)) {
    weights.set(value, (frequency.get(value) ?? 0) + ALGORITHMIC_FLOOR_WEIGHT)
  }

  const picked: number[] = []

  for (let round = 0; round < DRAW_NUMBER_COUNT; round += 1) {
    let total = 0
    for (const weight of weights.values()) total += weight

    const threshold = rng() * total
    let chosen = -1
    let cursor = 0
    let lastWeighted = -1

    for (const value of range(DRAW_NUMBER_MIN, DRAW_NUMBER_MAX)) {
      const weight = weights.get(value) ?? 0
      if (weight <= 0) continue
      lastWeighted = value
      cursor += weight
      if (threshold < cursor) {
        chosen = value
        break
      }
    }

    // Only reachable if the rng returns exactly 1.
    if (chosen === -1) chosen = lastWeighted

    picked.push(chosen)
    weights.delete(chosen)
  }

  return picked.sort((a, b) => a - b)
}

/* -------------------------------------------------------------------------- */
/* Simulation                                                                  */
/* -------------------------------------------------------------------------- */

export type SimulatedEntry = {
  userId: string
  numbers: number[]
}

export type SimulatedTier = {
  tier: PrizeTier
  winnerCount: number
  poolCents: number
  perWinnerCents: number
  rolloverCents: number
}

export type SimulatedEntryResult = {
  userId: string
  numbers: number[]
  matches: number
  tier: PrizeTier | null
  prizeCents: number
}

export type Simulation = {
  numbers: number[]
  drawType: DrawType
  totalPaymentsCents: number
  poolCents: number
  rolloverInCents: number
  rolloverOutCents: number
  tiers: SimulatedTier[]
  entries: SimulatedEntryResult[]
}

/**
 * Run a complete draw without persisting anything.
 *
 * This is the exact arithmetic an admin previews before publishing, and the
 * Postgres `publish_draw` function mirrors it step for step. Keeping it pure
 * means a simulation can be run repeatedly and cheaply, and that the numbers an
 * admin saw are the numbers that get committed.
 */
export function simulate(params: {
  entries: SimulatedEntry[]
  drawType: DrawType
  totalPaymentsCents: number
  rolloverInCents?: number
  rng?: RandomSource
}): Simulation {
  const { entries, drawType, totalPaymentsCents, rolloverInCents = 0, rng = cryptoRng } = params

  const numbers =
    drawType === 'random'
      ? drawRandom(rng)
      : drawAlgorithmic(frequencyFromEntries(entries.map((entry) => entry.numbers)), rng)

  const poolCents = computePool(totalPaymentsCents, rolloverInCents)
  const tierPools = splitTiers(poolCents)

  const resolved = entries.map((entry) => {
    const matches = countMatches(entry.numbers, numbers)
    return { ...entry, matches, tier: tierForMatches(matches) }
  })

  const winnerCounts = resolved.reduce(
    (acc, entry) => {
      if (entry.tier) acc[entry.tier] += 1
      return acc
    },
    { '5_match': 0, '4_match': 0, '3_match': 0 } as Record<PrizeTier, number>,
  )

  const tiers = (Object.keys(tierPools) as PrizeTier[]).map<SimulatedTier>((tier) => {
    const pool = tierPools[tier]
    const winnerCount = winnerCounts[tier]
    return {
      tier,
      winnerCount,
      poolCents: pool,
      perWinnerCents: perWinner(pool, winnerCount),
      rolloverCents: computeRollover(pool, winnerCount, tier),
    }
  })

  const prizeByTier = new Map(tiers.map((tier) => [tier.tier, tier.perWinnerCents]))

  return {
    numbers,
    drawType,
    totalPaymentsCents,
    poolCents,
    rolloverInCents,
    rolloverOutCents: tiers.reduce((sum, tier) => sum + tier.rolloverCents, 0),
    tiers,
    entries: resolved.map((entry) => ({
      userId: entry.userId,
      numbers: entry.numbers,
      matches: entry.matches,
      tier: entry.tier,
      prizeCents: entry.tier ? (prizeByTier.get(entry.tier) ?? 0) : 0,
    })),
  }
}
