import type { Share } from '../api/types'
import { memberColor } from '../lib/colors'

type Props = { shares: Share[]; indexOfMember: (memberId: string) => number }

export function ShareBar({ shares, indexOfMember }: Props) {
  // Decoration only; the list below holds the facts.
  return (
    <div className="share-bar" aria-hidden="true">
      {shares
        .filter((share) => share.amountCents > 0)
        .map((share) => (
          <span
            key={share.id}
            className={share.paidAt === null ? 'segment segment-unpaid' : 'segment'}
            style={{
              flexGrow: share.amountCents,
              backgroundColor: memberColor(indexOfMember(share.memberId)),
            }}
          />
        ))}
    </div>
  )
}
