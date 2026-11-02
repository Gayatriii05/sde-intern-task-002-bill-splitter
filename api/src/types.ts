/** Rows as stored in D1 (snake_case). */
export type MemberRow = { seq: number; id: string; home_id: string; name: string }
export type BillRow = { id: string; home_id: string; title: string; total_cents: number }
export type ShareRow = {
  id: string
  bill_id: string
  member_id: string
  amount_cents: number
  paid_at: string | null
  idempotency_key: string | null
}

/** Shapes sent to the client (camelCase). */
export type ShareDto = { id: string; memberId: string; amountCents: number; paidAt: string | null }
export type BillDto = {
  id: string
  homeId: string
  title: string
  totalCents: number
  shares: ShareDto[]
}

export const toShareDto = (row: ShareRow): ShareDto => ({
  id: row.id,
  memberId: row.member_id,
  amountCents: row.amount_cents,
  paidAt: row.paid_at,
})
