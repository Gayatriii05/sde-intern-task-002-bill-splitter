import { Hono } from 'hono'
import { notFound } from '../lib/errors'
import { assertHomeExists } from '../lib/homes'
import { readJsonObject, requireText } from '../lib/validate'
import type { MemberRow } from '../types'

export const homes = new Hono<{ Bindings: Env }>()

// POST /api/homes
homes.post('/', async (c) => {
  const body = await readJsonObject(c)
  const name = requireText(body.name, 'name')
  const id = crypto.randomUUID()

  await c.env.DB.prepare('INSERT INTO homes (id, name) VALUES (?, ?)').bind(id, name).run()
  return c.json({ id, name }, 201)
})

// GET /api/homes/:homeId  (extra: lets the web page show the home and its members)
homes.get('/:homeId', async (c) => {
  const homeId = c.req.param('homeId')
  const home = await c.env.DB.prepare('SELECT id, name FROM homes WHERE id = ?')
    .bind(homeId)
    .first<{ id: string; name: string }>()
  if (!home) throw notFound('Home')

  const { results } = await c.env.DB.prepare(
    'SELECT seq, id, home_id, name FROM members WHERE home_id = ? ORDER BY seq',
  )
    .bind(homeId)
    .all<MemberRow>()

  return c.json({
    id: home.id,
    name: home.name,
    members: results.map((m) => ({ id: m.id, homeId: m.home_id, name: m.name })),
  })
})

// POST /api/homes/:homeId/members
homes.post('/:homeId/members', async (c) => {
  const homeId = c.req.param('homeId')
  await assertHomeExists(c.env.DB, homeId)

  const body = await readJsonObject(c)
  const name = requireText(body.name, 'name')
  const id = crypto.randomUUID()

  await c.env.DB.prepare('INSERT INTO members (id, home_id, name) VALUES (?, ?, ?)')
    .bind(id, homeId, name)
    .run()
  return c.json({ id, homeId, name }, 201)
})
