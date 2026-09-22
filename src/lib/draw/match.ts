import type { PrizeTier } from '@/lib/constants'

/**
 * Multiset intersection size between a player's numbers and the winning numbers.
 *
 * A player's five numbers are their five Stableford scores, which may legitimately
 * repeat — two rounds of 30 is a normal fortnight. Each occurrence in the winning
 * set can therefore only be consumed once: holding [30, 30, 12, 8, 4] against a
 * draw containing a single 30 scores ONE match, not two.
 */
export function countMatches(playerNumbers: number[], winningNumbers: number[]): number {
  const remaining = new Map<number, number>()
  for (const value of winningNumbers) {
    remaining.set(value, (remaining.get(value) ?? 0) + 1)
  }

  let matches = 0
  for (const value of playerNumbers) {
    const left = remaining.get(value) ?? 0
    if (left > 0) {
      matches += 1
      remaining.set(value, left - 1)
    }
  }

  return matches
}

/** Map a match count onto a prize tier, or null when there is no prize. */
export function tierForMatches(matches: number): PrizeTier | null {
  if (matches >= 5) return '5_match'
  if (matches === 4) return '4_match'
  if (matches === 3) return '3_match'
  return null
}
