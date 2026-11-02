import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import { AddBillForm } from '../components/AddBillForm'
import { AddMemberForm } from '../components/AddMemberForm'
import { Avatar } from '../components/Avatar'
import { BillCard } from '../components/BillCard'
import { EmptyView, ErrorView, LoadingView } from '../components/StatusViews'
import { useHomeData } from '../hooks/useHomeData'
import { formatCents } from '../lib/money'
import { forgetRecentHome, saveRecentHome } from '../lib/recentHomes'

export const Route = createFileRoute('/homes/$homeId')({
  component: HomePage,
})

function HomePage() {
  const { homeId } = Route.useParams()
  const { state, reload, refresh } = useHomeData(homeId)
  const loadedId = state.status === 'ready' ? state.data.home.id : null
  const loadedName = state.status === 'ready' ? state.data.home.name : null
  const missing = state.status === 'error' && state.error.status === 404
  // Remember homes that loaded; forget ids the server says do not exist.
  useEffect(() => {
    if (loadedId && loadedName) saveRecentHome({ id: loadedId, name: loadedName })
  }, [loadedId, loadedName])
  useEffect(() => {
    if (missing) forgetRecentHome(homeId)
  }, [missing, homeId])

  if (state.status === 'loading') {
    return (
      <main className="page">
        <LoadingView label="Loading home…" />
      </main>
    )
  }

  if (state.status === 'error') {
    const notFound = state.error.status === 404
    return (
      <main className="page">
        <ErrorView
          message={notFound ? 'This home does not exist.' : state.error.message}
          onRetry={notFound ? undefined : reload}
        />
      </main>
    )
  }

  const { home, bills, balances } = state.data

  return (
    <main className="page">
      <h1>{home.name}</h1>
      <p className="muted">
        Home id: <code>{home.id}</code>
      </p>

      {state.refreshError && (
        <ErrorView
          message={`Could not refresh: ${state.refreshError}. Showing the last data we had.`}
          onRetry={refresh}
        />
      )}

      <section className="card">
        <h2>Members</h2>
        {balances.length === 0 ? (
          <EmptyView>No members yet. Add the first one below.</EmptyView>
        ) : (
          <ul className="balance-list">
            {balances.map((balance, index) => (
              <li key={balance.memberId}>
                <span className="balance-name">
                  <Avatar name={balance.name} index={index} />
                  {balance.name}
                </span>
                <span>
                  owes <strong>{formatCents(balance.outstandingCents)}</strong>
                </span>
              </li>
            ))}
          </ul>
        )}
        <AddMemberForm homeId={home.id} onAdded={refresh} />
      </section>

      <section className="card">
        <h2>New bill</h2>
        <AddBillForm homeId={home.id} hasMembers={home.members.length > 0} onAdded={refresh} />
      </section>

      <section>
        <h2>Bills</h2>
        {bills.length === 0 ? (
          <EmptyView>No bills yet.</EmptyView>
        ) : (
          bills.map((bill) => (
            <BillCard key={bill.id} bill={bill} members={home.members} onChanged={refresh} />
          ))
        )}
      </section>
    </main>
  )
}
