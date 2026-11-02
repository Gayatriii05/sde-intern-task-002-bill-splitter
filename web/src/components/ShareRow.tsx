import { useRef, useState } from 'react'
import { ApiError, payShare } from '../api/client'
import type { Share } from '../api/types'
import { formatCents } from '../lib/money'
import { Avatar } from './Avatar'

type Props = {
  billId: string
  share: Share
  memberName: string
  memberIndex: number
  /** Called after the server confirmed the payment (or says it was already paid). */
  onSettled: () => void
}

export function ShareRow({ billId, share, memberName, memberIndex, onSettled }: Props) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // One key per share. It is reused when the user retries, so a lost answer can never cause a
  // second payment: the server sees the same key and returns the same result.
  const idempotencyKey = useRef(crypto.randomUUID())

  async function handlePay() {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      await payShare(billId, share.id, idempotencyKey.current)
      onSettled()
    } catch (caught) {
      // The share stays unpaid on screen: we only change it when the server says it worked.
      const apiError = caught instanceof ApiError ? caught : null
      setError(apiError?.message ?? 'Payment failed. Please try again.')
      // 409: somebody else already paid it. Refresh so the screen shows the real state.
      if (apiError?.status === 409 || apiError?.status === 404) onSettled()
    } finally {
      setPending(false)
    }
  }

  const paid = share.paidAt !== null

  return (
    <li className="share">
      <div className="share-main">
        <Avatar name={memberName} index={memberIndex} />
        <span className="share-name">{memberName}</span>
        <span className="share-amount">{formatCents(share.amountCents)}</span>
        {paid ? (
          <span className="badge badge-paid">Paid</span>
        ) : (
          <button
            type="button"
            className="btn-pay"
            onClick={handlePay}
            disabled={pending}
            aria-busy={pending}
          >
            {pending ? 'Paying…' : error ? 'Retry payment' : 'Pay'}
          </button>
        )}
      </div>
      {!paid && error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
    </li>
  )
}
