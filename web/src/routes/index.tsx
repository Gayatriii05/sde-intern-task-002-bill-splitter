import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'
import { ApiError, createHome } from '../api/client'
import { readRecentHomes, saveRecentHome } from '../lib/recentHomes'

export const Route = createFileRoute('/')({
  component: Landing,
})

function Landing() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [openId, setOpenId] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recent] = useState(readRecentHomes)

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    if (name.trim().length === 0) return setError('Enter a name for the home.')
    setPending(true)
    setError(null)
    try {
      const home = await createHome(name.trim())
      saveRecentHome({ id: home.id, name: home.name })
      await navigate({ to: '/homes/$homeId', params: { homeId: home.id } })
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not create the home.')
    } finally {
      setPending(false)
    }
  }

  async function handleOpen(event: FormEvent) {
    event.preventDefault()
    const id = openId.trim()
    if (id) await navigate({ to: '/homes/$homeId', params: { homeId: id } })
  }

  return (
    <main className="page">
      <section className="hero">
        <div>
          <h1>Split shared bills to the cent</h1>
          <p className="lede">
            Make a home, add everyone who lives there, then split a bill. Each person pays their own
            share.
          </p>
        </div>
      </section>
      {recent.length > 0 && (
        <section className="card recent">
          <h2>Recent homes</h2>
          <ul className="recent-list">
            {recent.map((home) => (
              <li key={home.id}>
                <Link to="/homes/$homeId" params={{ homeId: home.id }}>
                  {home.name}
                </Link>
                <code>{home.id.slice(0, 8)}</code>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="grid-2">
        <section className="card">
          <h2>Create a home</h2>
          <form onSubmit={handleCreate} className="form-row">
            <label>
              Home name
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
            </label>
            <button type="submit" disabled={pending}>
              {pending ? 'Creating…' : 'Create home'}
            </button>
            {error && (
              <p role="alert" className="error-text">
                {error}
              </p>
            )}
          </form>
        </section>
        <section className="card">
          <h2>Open a home</h2>
          <form onSubmit={handleOpen} className="form-row">
            <label>
              Home id
              <input value={openId} onChange={(e) => setOpenId(e.target.value)} />
            </label>
            <button type="submit">Open home</button>
          </form>
        </section>
      </div>
    </main>
  )
}
