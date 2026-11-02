import { Hono } from 'hono'
import { assertHomeExists } from '../lib/homes'

export const balances = new Hono<{ Bindings: Env }>()

// GET /api/homes/:homeId/balances
balances.get('/:homeId/balances', async (c) => {
  const homeId = c.req.param('homeId')
  await assertHomeExists(c.env.DB, homeId)

  // LEFT JOIN so members without shares still appear with 0. Order = order members were added.
  const { results } = await c.env.DB.prepare(
    `SELECT m.id AS member_id, m.name AS name,
            COALESCE(SUM(CASE WHEN s.paid_at IS NULL THEN s.amount_cents END), 0) AS outstanding_cents
     FROM members m
     LEFT JOIN shares s ON s.member_id = m.id
     WHERE m.home_id = ?
     GROUP BY m.seq
     ORDER BY m.seq`,
  )
    .bind(homeId)
    .all<{ member_id: string; name: string; outstanding_cents: number }>()

  return c.json({
    balances: results.map((row) => ({
      memberId: row.member_id,
      name: row.name,
      outstandingCents: row.outstanding_cents,
    })),
  })
})
