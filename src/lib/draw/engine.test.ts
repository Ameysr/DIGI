import { describe, expect, it } from 'vitest'
import {
  DRAW_NUMBER_COUNT,
  DRAW_NUMBER_MAX,
  DRAW_NUMBER_MIN,
  PRIZE_POOL_RATE,
} from '@/lib/constants'
import {
  ALGORITHMIC_FLOOR_WEIGHT,
  type RandomSource,
  drawAlgorithmic,
  drawRandom,
  frequencyFromEntries,
  simulate,
} from './engine'

/** Deterministic xorshift32 so a failing draw can be replayed exactly. */
function seededRng(seed: number): RandomSource {
  let state = seed >>> 0 || 1
  return () => {
    state ^= state << 13
    state >>>= 0
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return state / 0x1_0000_0000
  }
}

describe('drawRandom', () => {
  it('draws five distinct numbers inside the legal range', () => {
    for (let run = 0; run < 500; run += 1) {
      const numbers = drawRandom()
      expect(numbers).toHaveLength(DRAW_NUMBER_COUNT)
      expect(new Set(numbers).size).toBe(DRAW_NUMBER_COUNT)
      for (const value of numbers) {
        expect(Number.isInteger(value)).toBe(true)
        expect(value).toBeGreaterThanOrEqual(DRAW_NUMBER_MIN)
        expect(value).toBeLessThanOrEqual(DRAW_NUMBER_MAX)
      }
    }
  })

  it('returns the numbers in ascending order', () => {
    const numbers = drawRandom(seededRng(42))
    expect([...numbers].sort((a, b) => a - b)).toEqual(numbers)
  })

  it('is reproducible for a given seed', () => {
    expect(drawRandom(seededRng(7))).toEqual(drawRandom(seededRng(7)))
  })

  it('reaches the extremes of the range over many draws', () => {
    const seen = new Set<number>()
    for (let run = 0; run < 2_000; run += 1) {
      for (const value of drawRandom()) seen.add(value)
    }
    expect(seen.has(DRAW_NUMBER_MIN)).toBe(true)
    expect(seen.has(DRAW_NUMBER_MAX)).toBe(true)
  })
})

describe('frequencyFromEntries', () => {
  it('tallies every occurrence, including duplicates', () => {
    const frequency = frequencyFromEntries([
      [30, 30, 12],
      [30, 8],
    ])
    expect(frequency.get(30)).toBe(3)
    expect(frequency.get(12)).toBe(1)
    expect(frequency.get(8)).toBe(1)
    expect(frequency.get(45)).toBeUndefined()
  })
})

describe('drawAlgorithmic', () => {
  it('still draws five distinct numbers inside the legal range', () => {
    for (let run = 0; run < 300; run += 1) {
      const numbers = drawAlgorithmic(new Map([[30, 12]]))
      expect(numbers).toHaveLength(DRAW_NUMBER_COUNT)
      expect(new Set(numbers).size).toBe(DRAW_NUMBER_COUNT)
      for (const value of numbers) {
        expect(value).toBeGreaterThanOrEqual(DRAW_NUMBER_MIN)
        expect(value).toBeLessThanOrEqual(DRAW_NUMBER_MAX)
      }
    }
  })

  it('favours numbers that were scored more often', () => {
    const frequency = new Map<number, number>([[45, 5_000]])
    let occurrences = 0
    const runs = 400

    for (let run = 0; run < runs; run += 1) {
      if (drawAlgorithmic(frequency).includes(45)) occurrences += 1
    }

    // Uniform chance of 45 appearing is 5/45 ≈ 11%; a heavy weight should
    // dominate. Assert well above that so the test is not flaky.
    expect(occurrences / runs).toBeGreaterThan(0.9)
  })

  it('keeps never-scored numbers reachable via the floor weight', () => {
    // Every number carries the floor, so a draw with no frequency data is valid
    // and can still produce any number.
    const seen = new Set<number>()
    const rng = seededRng(99)
    for (let run = 0; run < 2_000; run += 1) {
      for (const value of drawAlgorithmic(new Map(), rng)) seen.add(value)
    }
    expect(seen.size).toBeGreaterThan(ALGORITHMIC_FLOOR_WEIGHT * 40)
    expect(seen.has(DRAW_NUMBER_MAX)).toBe(true)
  })

  it('does not repeat a number that was already picked', () => {
    const numbers = drawAlgorithmic(new Map([[9, 100]]), seededRng(3))
    expect(new Set(numbers).size).toBe(DRAW_NUMBER_COUNT)
  })
})

describe('simulate', () => {
  const winningEntry = { userId: 'winner', numbers: [1, 2, 3, 4, 5] }

  it('awards the jackpot to a five-number match', () => {
    const result = simulate({
      entries: [winningEntry],
      drawType: 'random',
      totalPaymentsCents: 100_000,
      rng: seededRng(1),
    })

    // Force the entry to match by drawing exactly its numbers.
    const forced = simulate({
      entries: [winningEntry],
      drawType: 'random',
      totalPaymentsCents: 100_000,
      rng: () => 0,
    })

    expect(result.entries).toHaveLength(1)
    expect(forced.tiers.find((tier) => tier.tier === '5_match')?.winnerCount).toBe(1)
  })

  it('computes the pool from payments plus any carried-in jackpot', () => {
    const result = simulate({
      entries: [],
      drawType: 'random',
      totalPaymentsCents: 50_000,
      rolloverInCents: 1_000,
      rng: seededRng(5),
    })
    expect(result.poolCents).toBe(50_000 * PRIZE_POOL_RATE + 1_000)
  })

  it('rolls the jackpot forward when nobody matches five', () => {
    // An impossible-to-match entry guarantees the jackpot goes unclaimed.
    const result = simulate({
      entries: [{ userId: 'unlucky', numbers: [1, 1, 1, 1, 1] }],
      drawType: 'random',
      totalPaymentsCents: 100_000,
      rng: () => 0.999,
    })

    const jackpot = result.tiers.find((tier) => tier.tier === '5_match')
    expect(jackpot?.winnerCount).toBe(0)
    expect(result.rolloverOutCents).toBe(jackpot?.poolCents)
  })

  it('never rolls the lower tiers forward', () => {
    const result = simulate({
      entries: [],
      drawType: 'random',
      totalPaymentsCents: 100_000,
      rng: seededRng(11),
    })
    const lower = result.tiers.filter((tier) => tier.tier !== '5_match')
    expect(lower.every((tier) => tier.rolloverCents === 0)).toBe(true)
  })

  it('splits a tier equally between co-winners', () => {
    const result = simulate({
      entries: [
        { userId: 'a', numbers: [1, 2, 3, 4, 5] },
        { userId: 'b', numbers: [1, 2, 3, 4, 5] },
      ],
      drawType: 'random',
      totalPaymentsCents: 100_000,
      rng: () => 0,
    })

    const jackpot = result.tiers.find((tier) => tier.tier === '5_match')
    expect(jackpot?.winnerCount).toBe(2)
    expect(jackpot?.perWinnerCents).toBe(Math.floor((jackpot?.poolCents ?? 0) / 2))
  })

  it('accounts for every cent of the pool across tiers', () => {
    const result = simulate({
      entries: [{ userId: 'a', numbers: [4, 8, 15, 16, 23] }],
      drawType: 'algorithmic',
      totalPaymentsCents: 77_777,
      rolloverInCents: 333,
      rng: seededRng(21),
    })

    const tierTotal = result.tiers.reduce((sum, tier) => sum + tier.poolCents, 0)
    expect(tierTotal).toBe(result.poolCents)
  })

  it('only enters numbers the player actually holds', () => {
    const result = simulate({
      entries: [{ userId: 'a', numbers: [4, 8, 15, 16, 23] }],
      drawType: 'random',
      totalPaymentsCents: 10_000,
      rng: seededRng(31),
    })
    expect(result.entries[0].numbers).toEqual([4, 8, 15, 16, 23])
    expect(result.entries[0].matches).toBeGreaterThanOrEqual(0)
    expect(result.entries[0].matches).toBeLessThanOrEqual(5)
  })
})
