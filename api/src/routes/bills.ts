import { Hono } from 'hono'
import { HttpError } from '../lib/errors'
import { assertHomeExists } from '../lib/homes'
import { splitCents } from '../lib/split'
import { readJsonObject, requireText, requireTotalCents } from '../lib/validate'
import { type BillDto, type BillRow, type ShareRow, toShareDto } from '../types'

export const bills = new Hono<{ Bindings: Env }>()

// POST /api/homes/:homeId/bills
bills.post('/:homeId/bills', async (c) => {
  const db = c.env.DB
  const homeId = c.req.param('homeId')
  await assertHomeExists(db, homeId)

  const body = await readJsonObject(c)
  const title = requireText(body.title, 'title')
  const totalCents = requireTotalCents(body.totalCents)

  // Members in the order they were added (seq). This order decides who gets the extra cents.
  const { results: members } = await db
    .prepare('SELECT id FROM members WHERE home_id = ? ORDER BY seq')
    .bind(homeId)
    .all<{ id: string }>()
  if (members.length === 0) throw new HttpError(422, 'Home has no members to split the bill with')

  const amounts = splitCents(totalCents, members.length)
  const billId = crypto.randomUUID()

  const shares: ShareRow[] = members.map((member, index) => ({
    id: crypto.randomUUID(),
    bill_id: billId,
    member_id: member.id,
    amount_cents: amounts[index] ?? 0,
    paid_at: null,
    idempotency_key: null,
  }))

  // db.batch runs all statements in ONE transaction: a bill never exists without its shares.
  await db.batch([
    db
      .prepare('INSERT INTO bills (id, home_id, title, total_cents) VALUES (?, ?, ?, ?)')
      .bind(billId, homeId, title, totalCents),
    ...shares.map((share) =>
      db
        .prepare('INSERT INTO shares (id, bill_id, member_id, amount_cents) VALUES (?, ?, ?, ?)')
        .bind(share.id, share.bill_id, share.member_id, share.amount_cents),
    ),
  ])

  const dto: BillDto = { id: billId, homeId, title, totalCents, shares: shares.map(toShareDto) }
  return c.json(dto, 201)
})

// GET /api/homes/:homeId/bills  (extra: the web page needs to list bills)
bills.get('/:homeId/bills', async (c) => {
  const db = c.env.DB
  const homeId = c.req.param('homeId')
  await assertHomeExists(db, homeId)

  // Newest bill first (rowid grows with every insert).
  const { results: billRows } = await db
    .prepare(
      'SELECT id, home_id, title, total_cents FROM bills WHERE home_id = ? ORDER BY rowid DESC',
    )
    .bind(homeId)
    .all<BillRow>()

  // All shares of the home in one query, in member order.
  const { results: shareRows } = await db
    .prepare(
      `SELECT s.id, s.bill_id, s.member_id, s.amount_cents, s.paid_at, s.idempotency_key
       FROM shares s
       JOIN bills b ON b.id = s.bill_id
       JOIN members m ON m.id = s.member_id
       WHERE b.home_id = ?
       ORDER BY m.seq`,
    )
    .bind(homeId)
    .all<ShareRow>()

  const sharesByBill = new Map<string, ShareRow[]>()
  for (const share of shareRows) {
    const list = sharesByBill.get(share.bill_id) ?? []
    list.push(share)
    sharesByBill.set(share.bill_id, list)
  }

  const result: BillDto[] = billRows.map((bill) => ({
    id: bill.id,
    homeId: bill.home_id,
    title: bill.title,
    totalCents: bill.total_cents,
    shares: (sharesByBill.get(bill.id) ?? []).map(toShareDto),
  }))
  return c.json({ bills: result })
})
