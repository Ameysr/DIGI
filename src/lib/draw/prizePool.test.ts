import { describe, expect, it } from 'vitest'
import { PRIZE_POOL_RATE, PRIZE_TIERS } from '@/lib/constants'
import { computePool, computeRollover, perWinner, splitTiers } from './prizePool'

describe('computePool', () => {
  it('takes the configured share of collected payments', () => {
    expect(computePool(10_000, 0)).toBe(10_000 * PRIZE_POOL_RATE)
  })

  it('adds the carried-in jackpot on top of the new pool', () => {
    expect(computePool(10_000, 2_500)).toBe(10_000 * PRIZE_POOL_RATE + 2_500)
  })

  it('is zero when nothing was collected and nothing carried in', () => {
    expect(computePool(0, 0)).toBe(0)
  })
})

describe('splitTiers', () => {
  it('splits according to the configured tier weights', () => {
    const tiers = splitTiers(100_000)
    expect(tiers['5_match']).toBe(40_000)
    expect(tiers['4_match']).toBe(35_000)
    expect(tiers['3_match']).toBe(25_000)
  })

  it('always distributes the pool exactly, never losing a cent', () => {
    // Odd pool sizes are where naive rounding strands money.
    for (let pool = 0; pool <= 20_000; pool += 7) {
      const tiers = splitTiers(pool)
      const sum = PRIZE_TIERS.reduce((total, tier) => total + tiers[tier], 0)
      expect(sum).toBe(pool)
    }
  })

  it('handles an empty pool', () => {
    const tiers = splitTiers(0)
    expect(PRIZE_TIERS.every((tier) => tiers[tier] === 0)).toBe(true)
  })
})

describe('perWinner', () => {
  it('splits a tier equally between winners', () => {
    expect(perWinner(30_000, 3)).toBe(10_000)
  })

  it('rounds down rather than overpaying', () => {
    expect(perWinner(10_000, 3)).toBe(3333)
  })

  it('pays nothing when nobody won', () => {
    expect(perWinner(10_000, 0)).toBe(0)
  })
})

describe('computeRollover', () => {
  it('carries the jackpot forward when nobody matches five', () => {
    expect(computeRollover(40_000, 0, '5_match')).toBe(40_000)
  })

  it('clears the jackpot once it is won', () => {
    expect(computeRollover(40_000, 1, '5_match')).toBe(0)
  })

  it('never rolls the lower tiers forward', () => {
    expect(computeRollover(35_000, 0, '4_match')).toBe(0)
    expect(computeRollover(25_000, 0, '3_match')).toBe(0)
  })

  it('defaults to the jackpot tier', () => {
    expect(computeRollover(40_000, 0)).toBe(40_000)
  })
})
