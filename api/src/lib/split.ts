/**
 * Splits `totalCents` between `count` people.
 *
 * Every person gets floor(total / count). The leftover cents (total % count) go one by one to the
 * first people in the list, so the parts always add up to the total.
 * Example: splitCents(1000, 3) -> [334, 333, 333]
 */
export function splitCents(totalCents: number, count: number): number[] {
  if (!Number.isSafeInteger(totalCents) || totalCents <= 0) {
    throw new RangeError('totalCents must be a positive whole number')
  }
  if (!Number.isSafeInteger(count) || count <= 0) {
    throw new RangeError('count must be a positive whole number')
  }

  const base = Math.floor(totalCents / count)
  const remainder = totalCents % count
  return Array.from({ length: count }, (_, index) => (index < remainder ? base + 1 : base))
}
