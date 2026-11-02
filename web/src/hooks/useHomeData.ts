import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, getBalances, getBills, getHome, isAbort } from '../api/client'
import type { Balance, Bill, HomeDetails } from '../api/types'

export type HomeData = { home: HomeDetails; bills: Bill[]; balances: Balance[] }

export type HomeState =
  | { status: 'loading' }
  | { status: 'error'; error: ApiError }
  | { status: 'ready'; data: HomeData; refreshError: string | null }

/**
 * Loads a home with its bills and balances.
 * - First load shows `loading`, a failure shows `error` (with retry via `reload`).
 * - Later refreshes keep the old data on screen; if they fail we only set `refreshError`.
 */
export function useHomeData(homeId: string) {
  const [state, setState] = useState<HomeState>({ status: 'loading' })
  const latest = useRef(0)

  const load = useCallback(
    async (mode: 'initial' | 'refresh', signal?: AbortSignal) => {
      const requestId = ++latest.current // ignore answers that arrive after a newer request
      if (mode === 'initial') setState({ status: 'loading' })
      try {
        const [home, bills, balances] = await Promise.all([
          getHome(homeId, signal),
          getBills(homeId, signal),
          getBalances(homeId, signal),
        ])
        if (requestId !== latest.current) return
        setState({ status: 'ready', data: { home, bills, balances }, refreshError: null })
      } catch (error) {
        if (isAbort(error) || requestId !== latest.current) return
        const apiError =
          error instanceof ApiError ? error : new ApiError('network', 'Something went wrong.')
        setState((previous) =>
          mode === 'refresh' && previous.status === 'ready'
            ? { ...previous, refreshError: apiError.message }
            : { status: 'error', error: apiError },
        )
      }
    },
    [homeId],
  )

  useEffect(() => {
    const controller = new AbortController()
    void load('initial', controller.signal)
    return () => controller.abort()
  }, [load])

  return {
    state,
    reload: () => load('initial'),
    refresh: () => load('refresh'),
  }
}
