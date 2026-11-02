import { type FormEvent, useState } from 'react'
import { ApiError, addMember } from '../api/client'

type Props = { homeId: string; onAdded: () => void }

export function AddMemberForm({ homeId, onAdded }: Props) {
  const [name, setName] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    if (name.trim().length === 0) {
      setError('Enter a name.')
      return
    }
    setPending(true)
    setError(null)
    try {
      await addMember(homeId, name.trim())
      setName('')
      onAdded()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not add the member.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="form-row">
      <label>
        Member name
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add member'}
      </button>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
    </form>
  )
}
