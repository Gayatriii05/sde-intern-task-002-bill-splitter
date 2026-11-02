import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { type Balance, type Bill, call, createBill, createHome, type Share } from './helpers'

async function rawCall(path: string, init: RequestInit) {
  const { exports } = await import('cloudflare:workers')
  const response = await exports.default.fetch(new Request(`http://localhost${path}`, init))
  return { status: response.status, body: (await response.json()) as { error?: string } }
}

function pay(billId: string, shareId: string, key: string) {
  return call<Share>('POST', `/api/bills/${billId}/shares/${shareId}/pay`, {
    headers: { 'Idempotency-Key': key },
  })
}

async function setup(total = 1000, names = ['Asha', 'Ben']) {
  const { homeId, members } = await createHome(names)
  const bill = await createBill(homeId, total)
  const share = bill.body.shares[0]
  if (!share) throw new Error('no share')
  return { homeId, members, bill: bill.body, share }
}

describe('error format', () => {
  it('answers an unknown route with JSON { error }', async () => {
    const res = await call<{ error: string }>('GET', '/api/nope')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: expect.any(String) })
  })

  it('answers every error with { error: string }', async () => {
    const cases = [
      await call<{ error: string }>('POST', '/api/homes/x/members', { body: { name: 'A' } }),
      await call<{ error: string }>('POST', '/api/bills/x/shares/y/pay'),
      await call<{ error: string }>('GET', '/api/homes/x/balances'),
    ]
    for (const res of cases) expect(res.body).toEqual({ error: expect.any(String) })
  })

  it('returns 400 for a body that is not JSON', async () => {
    const res = await rawCall('/api/homes', { method: 'POST', body: '{nope' })
    expect(res.status).toBe(400)
    expect(res.body.error).toEqual(expect.any(String))
  })

  it.each([undefined, '', '   ', 42, null])('rejects the home name %j', async (name) => {
    const res = await call('POST', '/api/homes', { body: { name } })
    expect(res.status).toBe(422)
  })
})

describe('bills', () => {
  it.each([1.5, Number.MAX_SAFE_INTEGER + 2, true, [], {}])('rejects the amount %j', async (v) => {
    const { homeId } = await createHome(['Asha'])
    const res = await call('POST', `/api/homes/${homeId}/bills`, {
      body: { title: 'Rent', totalCents: v },
    })
    expect(res.status).toBe(422)
  })

  it('rejects a missing amount and a blank title', async () => {
    const { homeId } = await createHome(['Asha'])
    expect(
      (await call('POST', `/api/homes/${homeId}/bills`, { body: { title: 'x' } })).status,
    ).toBe(422)
    const blank = await call('POST', `/api/homes/${homeId}/bills`, {
      body: { title: '  ', totalCents: 100 },
    })
    expect(blank.status).toBe(422)
  })

  it('splits 1 cent between 3 members as 1, 0, 0', async () => {
    const { homeId } = await createHome(['A', 'B', 'C'])
    const bill = await createBill(homeId, 1)
    expect(bill.body.shares.map((s) => s.amountCents)).toEqual([1, 0, 0])
  })

  it('lists the bills of a home with their shares', async () => {
    const { homeId, bill } = await setup()
    const list = await call<{ bills: Bill[] }>('GET', `/api/homes/${homeId}/bills`)
    expect(list.status).toBe(200)
    expect(list.body.bills).toEqual([bill])
  })
})

describe('payments', () => {
  it('lets only one of two simultaneous payments with different keys win', async () => {
    const { bill, share } = await setup()
    const results = await Promise.all([
      pay(bill.id, share.id, crypto.randomUUID()),
      pay(bill.id, share.id, crypto.randomUUID()),
    ])
    expect(results.map((r) => r.status).sort()).toEqual([200, 409])
  })

  it('handles many simultaneous payments: exactly one wins', async () => {
    const { homeId, bill, share } = await setup()
    const results = await Promise.all(
      Array.from({ length: 10 }, () => pay(bill.id, share.id, crypto.randomUUID())),
    )
    expect(results.filter((r) => r.status === 200)).toHaveLength(1)
    expect(results.filter((r) => r.status === 409)).toHaveLength(9)
    const balances = await call<{ balances: Balance[] }>('GET', `/api/homes/${homeId}/balances`)
    expect(balances.body.balances.map((b) => b.outstandingCents)).toEqual([0, 500])
  })

  it('answers simultaneous requests with the SAME key with the same 200 result', async () => {
    const { bill, share } = await setup()
    const key = crypto.randomUUID()
    const results = await Promise.all([
      pay(bill.id, share.id, key),
      pay(bill.id, share.id, key),
      pay(bill.id, share.id, key),
    ])
    expect(results.every((r) => r.status === 200)).toBe(true)
    expect(new Set(results.map((r) => r.body.paidAt)).size).toBe(1)
  })

  it('keeps the original paidAt when a retry arrives later', async () => {
    const { bill, share } = await setup()
    const key = crypto.randomUUID()
    const first = await pay(bill.id, share.id, key)
    await new Promise((resolve) => setTimeout(resolve, 20))
    const second = await pay(bill.id, share.id, key)
    expect(second.body).toEqual(first.body)
  })

  it('rejects a blank Idempotency-Key', async () => {
    const { bill, share } = await setup()
    expect((await pay(bill.id, share.id, '   ')).status).toBe(400)
  })

  it('returns 404 when the share belongs to a different bill', async () => {
    const { homeId, share } = await setup()
    const other = await createBill(homeId, 500)
    expect((await pay(other.body.id, share.id, crypto.randomUUID())).status).toBe(404)
  })

  it('does not mark the share as paid when the bill id is wrong', async () => {
    const { homeId, bill, share } = await setup()
    await pay('wrong-bill', share.id, crypto.randomUUID())
    const list = await call<{ bills: Bill[] }>('GET', `/api/homes/${homeId}/bills`)
    expect(list.body.bills[0]?.shares.find((s) => s.id === share.id)?.paidAt).toBeNull()
    expect(bill.id).toBeTruthy()
  })
})

describe('balances', () => {
  it('shows 0 for a member of a home with no bills', async () => {
    const { homeId } = await createHome(['Asha'])
    const res = await call<{ balances: Balance[] }>('GET', `/api/homes/${homeId}/balances`)
    expect(res.body.balances.map((b) => b.outstandingCents)).toEqual([0])
  })

  it('returns an empty list for a home with no members', async () => {
    const { homeId } = await createHome([])
    const res = await call<{ balances: Balance[] }>('GET', `/api/homes/${homeId}/balances`)
    expect(res.status).toBe(200)
    expect(res.body.balances).toEqual([])
  })

  it('does not mix up two homes', async () => {
    await setup(1000, ['A', 'B'])
    const other = await createHome(['C'])
    const res = await call<{ balances: Balance[] }>('GET', `/api/homes/${other.homeId}/balances`)
    expect(res.body.balances.map((b) => b.outstandingCents)).toEqual([0])
  })
})

describe('database constraints (even if the API check is bypassed)', () => {
  async function insertHome() {
    const id = crypto.randomUUID()
    await env.DB.prepare('INSERT INTO homes (id, name) VALUES (?, ?)').bind(id, 'H').run()
    return id
  }

  it('bills_total_positive_integer rejects 0, negatives and decimals', async () => {
    const homeId = await insertHome()
    // Note: the text '100' is NOT tested here. SQLite converts it to the integer 100 (column
    // affinity), so it is valid at DB level; the API rejects strings before they reach the DB.
    for (const total of [0, -1, 10.5]) {
      const insert = env.DB.prepare(
        'INSERT INTO bills (id, home_id, title, total_cents) VALUES (?, ?, ?, ?)',
      ).bind(crypto.randomUUID(), homeId, 'T', total)
      await expect(insert.run()).rejects.toThrow()
    }
  })

  it('bills_home_fk rejects a bill for a missing home', async () => {
    const insert = env.DB.prepare(
      'INSERT INTO bills (id, home_id, title, total_cents) VALUES (?, ?, ?, ?)',
    ).bind(crypto.randomUUID(), 'missing-home', 'T', 100)
    await expect(insert.run()).rejects.toThrow()
  })

  it('shares_one_per_member_per_bill rejects a duplicate share', async () => {
    const { bill, members } = await (async () => {
      const s = await setup(1000, ['Asha'])
      return { bill: s.bill, members: s.members }
    })()
    const insert = env.DB.prepare(
      'INSERT INTO shares (id, bill_id, member_id, amount_cents) VALUES (?, ?, ?, ?)',
    ).bind(crypto.randomUUID(), bill.id, members[0]?.id, 1)
    await expect(insert.run()).rejects.toThrow()
  })

  it('shares_paid_state_consistent rejects paid_at without a key', async () => {
    const { share } = await setup()
    const update = env.DB.prepare('UPDATE shares SET paid_at = ? WHERE id = ?').bind(
      new Date().toISOString(),
      share.id,
    )
    await expect(update.run()).rejects.toThrow()
  })
})
