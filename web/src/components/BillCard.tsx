import type { Bill, Member } from '../api/types'
import { formatCents } from '../lib/money'
import { ShareBar } from './ShareBar'
import { ShareRow } from './ShareRow'

type Props = { bill: Bill; members: Member[]; onChanged: () => void }

export function BillCard({ bill, members, onChanged }: Props) {
  const nameOf = (memberId: string) => members.find((m) => m.id === memberId)?.name ?? 'Unknown'
  const indexOfMember = (id: string) => members.findIndex((m) => m.id === id)
  const unpaid = bill.shares.filter((share) => share.paidAt === null).length

  return (
    <article className="card">
      <header className="card-header">
        <h3>{bill.title}</h3>
        <strong>{formatCents(bill.totalCents)}</strong>
      </header>
      <p className="muted">
        {unpaid === 0 ? 'Everyone has paid.' : `${unpaid} of ${bill.shares.length} shares unpaid.`}
      </p>
      <ShareBar shares={bill.shares} indexOfMember={indexOfMember} />
      <ul className="share-list">
        {bill.shares.map((share) => (
          <ShareRow
            key={share.id}
            billId={bill.id}
            share={share}
            memberName={nameOf(share.memberId)}
            memberIndex={indexOfMember(share.memberId)}
            onSettled={onChanged}
          />
        ))}
      </ul>
    </article>
  )
}
