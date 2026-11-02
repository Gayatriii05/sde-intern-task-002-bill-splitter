import { type FormEvent, useState } from 'react'
import { ApiError, createBill } from '../api/client'
import { parseDollarsToCents } from '../lib/money'

type Props = { homeId: string; hasMembers: boolean; onAdded: () => void }

export function AddBillForm({ homeId, hasMembers, onAdded }: Props) {
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    const cents = parseDollarsToCents(amount)
    if (title.trim().length === 0) return setError('Enter a title.')
    if (cents === null) return setError('Enter an amount like 12 or 12.50 (more than zero).')

    setPending(true)
    setError(null)
    try {
      await createBill(homeId, title.trim(), cents)
      setTitle('')
      setAmount('')
      onAdded()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not create the bill.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="form-row">
      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} />
      </label>
      <label>
        Amount (USD)
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="10.00"
        />
      </label>
      <button type="submit" disabled={pending || !hasMembers}>
        {pending ? 'Splitting…' : 'Split bill'}
      </button>
      {!hasMembers && <p className="muted">Add at least one member before creating a bill.</p>}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
    </form>
  )
}
