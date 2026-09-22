import { describe, expect, it } from 'vitest'
import { countMatches, tierForMatches } from './match'

describe('countMatches', () => {
  it('counts a full five-number match', () => {
    expect(countMatches([3, 9, 14, 27, 41], [41, 3, 27, 9, 14])).toBe(5)
  })

  it('is order independent', () => {
    expect(countMatches([41, 3, 27, 9, 14], [3, 9, 14, 27, 41])).toBe(5)
  })

  it('returns zero when nothing matches', () => {
    expect(countMatches([1, 2, 3, 4, 5], [6, 7, 8, 9, 10])).toBe(0)
  })

  it('consumes each winning occurrence only once', () => {
    // Two rounds of 30, but the draw contains a single 30 — that is one match.
    expect(countMatches([30, 30, 12, 8, 4], [30, 7, 3, 2, 1])).toBe(1)
  })

  it('matches duplicate values on both sides up to the smaller count', () => {
    expect(countMatches([30, 30, 12, 8, 4], [30, 30, 7, 3, 2])).toBe(2)
    expect(countMatches([30, 30, 30, 8, 4], [30, 30, 7, 3, 2])).toBe(2)
  })

  it('does not exceed the player number count', () => {
    expect(countMatches([5, 5], [5, 5, 5, 5, 5])).toBe(2)
  })
})

describe('tierForMatches', () => {
  it('maps match counts onto tiers', () => {
    expect(tierForMatches(5)).toBe('5_match')
    expect(tierForMatches(4)).toBe('4_match')
    expect(tierForMatches(3)).toBe('3_match')
  })

  it('awards nothing below three matches', () => {
    expect(tierForMatches(2)).toBeNull()
    expect(tierForMatches(1)).toBeNull()
    expect(tierForMatches(0)).toBeNull()
  })
})
