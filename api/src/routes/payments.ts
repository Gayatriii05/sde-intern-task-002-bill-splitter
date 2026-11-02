import { Hono } from 'hono'
import { HttpError, notFound } from '../lib/errors'
import { requireIdempotencyKey } from '../lib/validate'
import { type ShareRow, toShareDto } from '../types'

export const payments = new Hono<{ Bindings: Env }>()

// POST /api/bills/:billId/shares/:shareId/pay
payments.post('/:billId/shares/:shareId/pay', async (c) => {
  const db = c.env.DB
  const key = requireIdempotencyKey(c.req.header('Idempotency-Key'))
  const billId = c.req.param('billId')
  const shareId = c.req.param('shareId')

  // ONE atomic statement. The WHERE ... paid_at IS NULL means that when two requests arrive at
  // the same time, the database lets exactly one of them change the row. No read-then-write gap.
  const won = await db
    .prepare(
      `UPDATE shares
       SET paid_at = ?, idempotency_key = ?
       WHERE id = ? AND bill_id = ? AND paid_at IS NULL
       RETURNING id, bill_id, member_id, amount_cents, paid_at, idempotency_key`,
    )
    .bind(new Date().toISOString(), key, shareId, billId)
    .first<ShareRow>()

  if (won) return c.json(toShareDto(won), 200)

  // Nothing was updated: the share is missing, or it was already paid.
  const existing = await db
    .prepare(
      `SELECT id, bill_id, member_id, amount_cents, paid_at, idempotency_key
       FROM shares WHERE id = ? AND bill_id = ?`,
    )
    .bind(shareId, billId)
    .first<ShareRow>()

  if (!existing) throw notFound('Bill or share')

  // Same key as the payment that already succeeded: a retry. Answer with the same result.
  if (existing.idempotency_key === key) return c.json(toShareDto(existing), 200)

  throw new HttpError(409, 'Share is already paid')
})
