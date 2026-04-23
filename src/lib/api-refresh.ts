import { API_URL } from '@/config/app.config'

// ─── Token refresh queue — prevents multiple concurrent refresh calls ────────

let isRefreshing = false
let refreshQueue: Array<{ resolve: () => void; reject: (err: Error) => void }> = []

function waitForRefresh(): Promise<void> {
  return new Promise((resolve, reject) => {
    refreshQueue.push({ resolve, reject })
  })
}

function flushRefreshQueue(error?: Error) {
  const queue = [...refreshQueue]
  refreshQueue = []
  queue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve()))
}

export async function attemptTokenRefresh(): Promise<boolean> {
  if (isRefreshing) {
    await waitForRefresh()
    return true
  }

  isRefreshing = true

  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })

    if (response.ok) {
      let json: { success?: boolean } | null = null
      try {
        json = await response.json()
      } catch {
        // Malformed JSON from refresh endpoint — treat as failure
      }
      if (json?.success) {
        isRefreshing = false
        flushRefreshQueue()
        return true
      }
    }

    // Refresh failed — clear cached user (let React Router handle redirect)
    sessionStorage.removeItem('cachedUser')
    isRefreshing = false
    flushRefreshQueue(new Error('Refresh failed'))
    return false
  } catch {
    isRefreshing = false
    flushRefreshQueue(new Error('Refresh network error'))
    return false
  }
}
