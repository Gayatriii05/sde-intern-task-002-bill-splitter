import { describe, expect, it } from 'vitest'
import { splitCents } from '../src/lib/split'

describe('splitCents', () => {
  it.each([
    [1000, 3, [334, 333, 333]],
    [1, 3, [1, 0, 0]],
    [2, 3, [1, 1, 0]],
    [3000, 3, [1000, 1000, 1000]],
    [4999, 1, [4999]],
    [100001, 7, [14286, 14286, 14286, 14286, 14286, 14286, 14285]],
  ])('splits %i cents between %i people', (total, count, expected) => {
    const parts = splitCents(total, count)
    expect(parts).toEqual(expected)
    expect(parts.reduce((a, b) => a + b, 0)).toBe(total)
  })

  it('always adds up to the total', () => {
    for (let total = 1; total <= 200; total++) {
      for (let count = 1; count <= 12; count++) {
        expect(splitCents(total, count).reduce((a, b) => a + b, 0)).toBe(total)
      }
    }
  })

  it.each([0, -5, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects total %j', (total) => {
    expect(() => splitCents(total, 2)).toThrow(RangeError)
  })

  it('rejects a count of zero', () => {
    expect(() => splitCents(100, 0)).toThrow(RangeError)
  })
})
