/**
 * Remembers the homes this browser created or opened, so they can be reopened later.
 * It lives only in this browser (localStorage). The server has no "list homes" endpoint.
 */
const STORAGE_KEY = 'billSplitter.recentHomes'
const MAX_RECENT = 10

export type RecentHome = { id: string; name: string }

function isRecentHome(value: unknown): value is RecentHome {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value &&
    typeof value.id === 'string' &&
    typeof value.name === 'string'
  )
}

/** Storage can be empty, full, blocked or edited by hand, so every access is guarded. */
export function readRecentHomes(): RecentHome[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter(isRecentHome) : []
  } catch {
    return []
  }
}

function write(homes: RecentHome[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(homes))
  } catch {
    // Storage is a convenience only. If it fails, the app still works.
  }
}

/** Puts the home first in the list (newest first) and keeps at most MAX_RECENT. */
export function saveRecentHome(home: RecentHome): void {
  const others = readRecentHomes().filter((item) => item.id !== home.id)
  write([home, ...others].slice(0, MAX_RECENT))
}

export function forgetRecentHome(id: string): void {
  write(readRecentHomes().filter((item) => item.id !== id))
}
