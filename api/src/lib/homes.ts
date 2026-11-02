import { notFound } from './errors'

/** Throws a 404 unless the home exists. */
export async function assertHomeExists(db: D1Database, homeId: string): Promise<void> {
  const home = await db.prepare('SELECT id FROM homes WHERE id = ?').bind(homeId).first<{
    id: string
  }>()
  if (!home) throw notFound('Home')
}
