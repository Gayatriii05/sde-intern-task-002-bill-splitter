import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { ErrorView } from '../components/StatusViews'

export const Route = createRootRoute({
  component: () => (
    <div className="app">
      <header className="app-header">
        <Link to="/" className="brand">
          <span className="logo" aria-hidden="true" />
          Bill Splitter
        </Link>
      </header>
      <Outlet />
    </div>
  ),
  // If anything in a page throws while rendering, show this instead of a blank screen.
  errorComponent: ({ error, reset }) => (
    <main className="page">
      <ErrorView
        message={(error instanceof Error && error.message) || 'Something went wrong.'}
        onRetry={reset}
      />
    </main>
  ),
  notFoundComponent: () => (
    <main className="page">
      <p>Page not found.</p>
      <Link to="/">Go back</Link>
    </main>
  ),
})
