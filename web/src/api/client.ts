import type { Balance, Bill, Home, HomeDetails, Member, Share } from './types'

/** Why a request failed. The UI shows a friendly message for each kind. */
export type ApiErrorKind = 'http' | 'network' | 'timeout' | 'invalid-response'

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  /** HTTP status, or null when there was no response (network error / timeout). */
  readonly status: number | null

  constructor(kind: ApiErrorKind, message: string, status: number | null = null) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
  }
}

const REQUEST_TIMEOUT_MS = 10_000

type RequestOptions = {
  method?: 'GET' | 'POST'
  body?: unknown
  headers?: Record<string, string>
  signal?: AbortSignal
}

/** Reads `{ error: string }` from a failed response, with a safe fallback. */
function errorMessage(body: unknown, status: number): string {
  if (typeof body === 'object' && body !== null && 'error' in body) {
    const { error } = body
    if (typeof error === 'string' && error.length > 0) return error
  }
  return `Request failed (${status})`
}

async function request(path: string, options: RequestOptions = {}): Promise<unknown> {
  // One AbortController handles both: a slow API (timeout) and the caller cancelling (unmount).
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, REQUEST_TIMEOUT_MS)
  const cancel = () => controller.abort()
  if (options.signal?.aborted) cancel()
  else options.signal?.addEventListener('abort', cancel, { once: true })

  try {
    let response: Response
    try {
      response = await fetch(path, {
        method: options.method ?? 'GET',
        headers: {
          ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
          ...options.headers,
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      })
    } catch {
      if (timedOut) throw new ApiError('timeout', 'The server took too long to answer.')
      if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      throw new ApiError('network', 'Could not reach the server.')
    }

    // The body may be empty or not JSON (for example a 502 page from a proxy). Never crash on it.
    // The timer stays active here too: a server that sends headers and then stalls the body still
    // hits the timeout instead of leaving the page waiting forever.
    let body: unknown = null
    try {
      body = await response.json()
    } catch {
      if (timedOut) throw new ApiError('timeout', 'The server took too long to answer.')
      if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      body = null
    }

    if (!response.ok) {
      throw new ApiError('http', errorMessage(body, response.status), response.status)
    }
    if (body === null)
      throw new ApiError('invalid-response', 'The server sent an unreadable answer.')
    return body
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', cancel)
  }
}

/** True when a request was cancelled on purpose (component left the screen). */
export const isAbort = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'AbortError'

// The server is ours, so we trust its shape here. Each function states what it returns.

export const getHome = (homeId: string, signal?: AbortSignal) =>
  request(`/api/homes/${encodeURIComponent(homeId)}`, { signal }) as Promise<HomeDetails>

export const getBills = async (homeId: string, signal?: AbortSignal) => {
  const body = (await request(`/api/homes/${encodeURIComponent(homeId)}/bills`, {
    signal,
  })) as { bills: Bill[] }
  return body.bills
}

export const getBalances = async (homeId: string, signal?: AbortSignal) => {
  const body = (await request(`/api/homes/${encodeURIComponent(homeId)}/balances`, {
    signal,
  })) as { balances: Balance[] }
  return body.balances
}

export const createHome = (name: string) =>
  request('/api/homes', { method: 'POST', body: { name } }) as Promise<Home>

export const addMember = (homeId: string, name: string) =>
  request(`/api/homes/${encodeURIComponent(homeId)}/members`, {
    method: 'POST',
    body: { name },
  }) as Promise<Member>

export const createBill = (homeId: string, title: string, totalCents: number) =>
  request(`/api/homes/${encodeURIComponent(homeId)}/bills`, {
    method: 'POST',
    body: { title, totalCents },
  }) as Promise<Bill>

export const payShare = (billId: string, shareId: string, idempotencyKey: string) =>
  request(`/api/bills/${encodeURIComponent(billId)}/shares/${encodeURIComponent(shareId)}/pay`, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
  }) as Promise<Share>
