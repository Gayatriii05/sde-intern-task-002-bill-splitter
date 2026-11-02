const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

/** Display only. Money is always stored and sent as whole cents. */
export function formatCents(cents: number): string {
  return formatter.format(cents / 100)
}

/**
 * Turns what the user typed ("12", "12.5", "12.34") into whole cents WITHOUT using decimals math.
 * Returns null for anything else (empty, negative, 3 decimals, text, zero).
 */
export function parseDollarsToCents(input: string): number | null {
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(input.trim())
  if (!match) return null
  const dollars = Number(match[1])
  const cents = Number((match[2] ?? '').padEnd(2, '0'))
  const total = dollars * 100 + cents
  return total > 0 ? total : null
}
