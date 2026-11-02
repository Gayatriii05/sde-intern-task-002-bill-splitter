import type { ReactNode } from 'react'

export function LoadingView({ label = 'Loading…' }: { label?: string }) {
  return (
    <p role="status" className="status">
      {label}
    </p>
  )
}

export function EmptyView({ children }: { children: ReactNode }) {
  return <p className="status empty">{children}</p>
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="status error-box">
      <p>{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}
