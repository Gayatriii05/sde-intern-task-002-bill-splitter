import { Hono } from 'hono'
import { HttpError } from './lib/errors'
import { balances } from './routes/balances'
import { bills } from './routes/bills'
import { homes } from './routes/homes'
import { payments } from './routes/payments'

const app = new Hono<{ Bindings: Env }>()

app.get('/api/health', (c) => c.json({ status: 'ok' }))

app.route('/api/homes', homes)
app.route('/api/homes', bills)
app.route('/api/homes', balances)
app.route('/api/bills', payments)

// Every error is JSON: { "error": "message" }.
app.notFound((c) => c.json({ error: 'Route not found' }, 404))

app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message }, err.status)
  // Unknown failure: log it for us, but never leak internals to the client.
  console.error(err)
  return c.json({ error: 'Internal server error' }, 500)
})

export default app
