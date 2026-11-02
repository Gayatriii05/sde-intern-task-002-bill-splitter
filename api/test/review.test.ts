import { describe, expect, it } from 'vitest'
import { splitCents } from '../src/lib/split'
import { type Balance, type Bill, call, createBill, createHome, type Share } from './helpers'

type ErrorBody = { error: string }

async function rawFetch(path: string, init: RequestInit) {
  const { exports } = await import('cloudflare:workers')
  const response = await exports.default.fetch(new Request(`http://localhost${path}`, init))
  const text = await response.text()
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    body = null
  }
  return { status: response.status, body }
}

function pay(billId: string, shareId: string, key: string) {
  return call<Share>('POST', `/api/bills/${billId}/shares/${shareId}/pay`, {
    headers: { 'Idempotency-Key': key },
  })
}

async function setup(total = 1000, names = ['Asha', 'Ben']) {
  const { homeId, members } = await createHome(names)
  const bill = await createBill(homeId, total)
  return { homeId, members, bill: bill.body }
}

describe('huge totals', () => {
  it('splits MAX_SAFE_INTEGER between many members so the parts add up exactly', async () => {
    const names = Array.from({ length: 13 }, (_, index) => `Member ${index + 1}`)
    const { homeId } = await createHome(names)

    const bill = await createBill(homeId, Number.MAX_SAFE_INTEGER)

    expect(bill.status).toBe(201)
    const amounts = bill.body.shares.map((share) => share.amountCents)
    expect(amounts).toEqual(splitCents(Number.MAX_SAFE_INTEGER, names.length))
    expect(amounts.reduce((sum, amount) => sum + amount, 0)).toBe(Number.MAX_SAFE_INTEGER)
    expect(amounts.every((amount) => Number.isSafeInteger(amount))).toBe(true)
  })
})

describe('input hardening', () => {
  it('trims whitespace and accepts unicode names', async () => {
    const spaced = await call<{ name: string }>('POST', '/api/homes', {
      body: { name: '  Asha  ' },
    })
    expect(spaced.status).toBe(201)
    expect(spaced.body.name).toBe('Asha')

    const unicode = await call<{ id: string; name: string }>('POST', '/api/homes', {
      body: { name: 'Casa Ñ 🏠' },
    })
    expect(unicode.status).toBe(201)
    expect(unicode.body.name).toBe('Casa Ñ 🏠')

    const member = await call<{ name: string }>('POST', `/api/homes/${unicode.body.id}/members`, {
      body: { name: '  李雷  ' },
    })
    expect(member.status).toBe(201)
    expect(member.body.name).toBe('李雷')
  })

  it('accepts names and titles up to 100 characters and rejects longer ones', async () => {
    const exact = await call<{ id: string }>('POST', '/api/homes', {
      body: { name: 'a'.repeat(100) },
    })
    expect(exact.status).toBe(201)

    const tooLong = await call<ErrorBody>('POST', '/api/homes', { body: { name: 'a'.repeat(101) } })
    expect(tooLong.status).toBe(422)
    expect(tooLong.body).toEqual({ error: expect.any(String) })

    await call('POST', `/api/homes/${exact.body.id}/members`, { body: { name: 'Asha' } })
    const titleExact = await call<Bill>('POST', `/api/homes/${exact.body.id}/bills`, {
      body: { title: 't'.repeat(100), totalCents: 100 },
    })
    expect(titleExact.status).toBe(201)

    const titleLong = await call<ErrorBody>('POST', `/api/homes/${exact.body.id}/bills`, {
      body: { title: 't'.repeat(101), totalCents: 100 },
    })
    expect(titleLong.status).toBe(422)
  })

  it('trims bill titles and keeps unicode', async () => {
    const { homeId } = await createHome(['Asha'])
    const bill = await call<Bill>('POST', `/api/homes/${homeId}/bills`, {
      body: { title: '  租金 – Électricité  ', totalCents: 100 },
    })
    expect(bill.status).toBe(201)
    expect(bill.body.title).toBe('租金 – Électricité')
  })

  it('rejects wrong types for every body field', async () => {
    const wrong = [42, true, null, [], {}, 10.5]
    for (const name of wrong) {
      const res = await call<ErrorBody>('POST', '/api/homes', { body: { name } })
      expect(res.status).toBe(422)
      expect(res.body).toEqual({ error: expect.any(String) })
    }

    const { homeId } = await createHome(['Asha'])
    for (const name of wrong) {
      const res = await call<ErrorBody>('POST', `/api/homes/${homeId}/members`, { body: { name } })
      expect(res.status).toBe(422)
    }
    for (const title of wrong) {
      const res = await call<ErrorBody>('POST', `/api/homes/${homeId}/bills`, {
        body: { title, totalCents: 100 },
      })
      expect(res.status).toBe(422)
    }
    const wrongTotals = [true, null, [], {}, 10.5, '1000', 0, -1, Number.MAX_SAFE_INTEGER + 2]
    for (const totalCents of wrongTotals) {
      const res = await call<ErrorBody>('POST', `/api/homes/${homeId}/bills`, {
        body: { title: 'Rent', totalCents },
      })
      expect(res.status).toBe(422)
    }
  })

  it('rejects an empty body, a JSON array and a JSON primitive with { error }', async () => {
    const empty = await rawFetch('/api/homes', { method: 'POST' })
    expect(empty.status).toBe(400)
    expect(empty.body).toEqual({ error: expect.any(String) })

    for (const body of ['[]', 'null', '"text"', '42']) {
      const res = await rawFetch('/api/homes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      })
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: expect.any(String) })
    }
  })

  it('accepts valid JSON even when the content-type header is missing', async () => {
    const res = await rawFetch('/api/homes', {
      method: 'POST',
      body: JSON.stringify({ name: 'No content type' }),
    })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ name: 'No content type' })
  })

  it('rejects a very long Idempotency-Key', async () => {
    const { bill } = await setup()
    const share = bill.shares[0]
    if (!share) throw new Error('no share')
    const res = await call<ErrorBody>('POST', `/api/bills/${bill.id}/shares/${share.id}/pay`, {
      headers: { 'Idempotency-Key': 'k'.repeat(256) },
    })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: expect.any(String) })
  })
})

describe('payment races', () => {
  it('lets two different shares of the same bill be paid in parallel', async () => {
    const { homeId, bill } = await setup(1000, ['Asha', 'Ben'])
    const [first, second] = bill.shares
    if (!first || !second) throw new Error('expected two shares')

    const results = await Promise.all([
      pay(bill.id, first.id, crypto.randomUUID()),
      pay(bill.id, second.id, crypto.randomUUID()),
    ])

    expect(results.map((result) => result.status)).toEqual([200, 200])
    expect(results.every((result) => typeof result.body.paidAt === 'string')).toBe(true)
    const balances = await call<{ balances: Balance[] }>('GET', `/api/homes/${homeId}/balances`)
    expect(balances.body.balances.map((balance) => balance.outstandingCents)).toEqual([0, 0])
  })

  it('answers five parallel payments with the same key with one result', async () => {
    const { bill } = await setup()
    const share = bill.shares[0]
    if (!share) throw new Error('no share')
    const key = crypto.randomUUID()

    const results = await Promise.all(Array.from({ length: 5 }, () => pay(bill.id, share.id, key)))

    expect(results.every((result) => result.status === 200)).toBe(true)
    expect(new Set(results.map((result) => result.body.paidAt)).size).toBe(1)
  })

  it('lets exactly one of twenty parallel payments with different keys win', async () => {
    const { homeId, bill } = await setup()
    const share = bill.shares[0]
    if (!share) throw new Error('no share')

    const results = await Promise.all(
      Array.from({ length: 20 }, () => pay(bill.id, share.id, crypto.randomUUID())),
    )

    expect(results.filter((result) => result.status === 200)).toHaveLength(1)
    expect(results.filter((result) => result.status === 409)).toHaveLength(19)
    const balances = await call<{ balances: Balance[] }>('GET', `/api/homes/${homeId}/balances`)
    expect(balances.body.balances.map((balance) => balance.outstandingCents)).toEqual([0, 500])
  })
})

describe('wrong or odd ids', () => {
  it('does not pay a share through the wrong bill id, even with special characters', async () => {
    const { homeId, bill } = await setup()
    const share = bill.shares[0]
    if (!share) throw new Error('no share')
    const wrongBill = encodeURIComponent('../another bill?x=1')

    const res = await call<ErrorBody>('POST', `/api/bills/${wrongBill}/shares/${share.id}/pay`, {
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    })

    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: expect.any(String) })
    const list = await call<{ bills: Bill[] }>('GET', `/api/homes/${homeId}/bills`)
    expect(list.body.bills[0]?.shares.find((item) => item.id === share.id)?.paidAt).toBeNull()
  })

  it('answers special-character ids with JSON 404, not plain text', async () => {
    const weirdHome = encodeURIComponent('../etc/passwd?x=1')
    const res = await call<ErrorBody>('GET', `/api/homes/${weirdHome}/balances`)
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: expect.any(String) })
  })
})

describe('many homes stay separate', () => {
  it('never mixes balances between homes', async () => {
    const homes: { homeId: string; names: string[] }[] = []
    for (let index = 0; index < 5; index++) {
      const names = [`H${index}-A`, `H${index}-B`, `H${index}-C`]
      const { homeId } = await createHome(names)
      homes.push({ homeId, names })
    }

    for (const [index, home] of homes.entries()) {
      await createBill(home.homeId, 1000 + index)
    }

    for (const home of homes) {
      const res = await call<{ balances: Balance[] }>('GET', `/api/homes/${home.homeId}/balances`)
      expect(res.body.balances.map((balance) => balance.name)).toEqual(home.names)
      expect(res.body.balances).toHaveLength(3)
      const total = res.body.balances.reduce((sum, balance) => sum + balance.outstandingCents, 0)
      expect(total).toBe(1000 + homes.indexOf(home))
    }
  })
})
