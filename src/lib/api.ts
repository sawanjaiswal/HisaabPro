import { API_URL, TIMEOUTS } from '@/config/app.config'

interface ApiOptions extends RequestInit {
  timeout?: number
  /** Skip the 401 refresh interceptor (used by refresh call itself) */
  _skipRefresh?: boolean
}

interface ApiResponse<T> {
  success: boolean
  data: T
  error?: { code: string; message: string }
}

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

async function attemptTokenRefresh(): Promise<boolean> {
  if (isRefreshing) {
    await waitForRefresh()
    return !!sessionStorage.getItem('accessToken')
  }

  isRefreshing = true
  const refreshToken = sessionStorage.getItem('refreshToken')

  if (!refreshToken) {
    isRefreshing = false
    flushRefreshQueue(new Error('No refresh token'))
    return false
  }

  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })

    const json = await response.json()

    if (response.ok && json.success && json.data?.tokens) {
      sessionStorage.setItem('accessToken', json.data.tokens.accessToken)
      sessionStorage.setItem('refreshToken', json.data.tokens.refreshToken)
      isRefreshing = false
      flushRefreshQueue()
      return true
    }

    // Refresh failed — clear auth and redirect to login
    sessionStorage.removeItem('accessToken')
    sessionStorage.removeItem('refreshToken')
    sessionStorage.removeItem('cachedUser')
    isRefreshing = false
    flushRefreshQueue(new Error('Refresh failed'))
    window.location.href = '/login'
    return false
  } catch {
    isRefreshing = false
    flushRefreshQueue(new Error('Refresh network error'))
    return false
  }
}

// ─── Main API wrapper ────────────────────────────────────────────────────────

/**
 * Fetch wrapper with timeout, auth header, abort support,
 * and automatic 401 token refresh with request queue.
 */
export async function api<T>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const { timeout = TIMEOUTS.fetchMs, _skipRefresh, ...fetchOptions } = options

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort())
  }

  const token = sessionStorage.getItem('accessToken')

  const response = await fetch(`${API_URL}${path}`, {
    ...fetchOptions,
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...fetchOptions.headers,
    },
  }).finally(() => clearTimeout(timeoutId))

  // 401 interceptor — attempt token refresh, then retry the original request
  if (response.status === 401 && !_skipRefresh && !path.includes('/auth/')) {
    const refreshed = await attemptTokenRefresh()
    if (refreshed) {
      // Retry with new token
      return api<T>(path, { ...options, _skipRefresh: true })
    }
    throw new ApiError('Session expired', 'UNAUTHORIZED', 401)
  }

  const json: ApiResponse<T> = await response.json()

  if (!response.ok || !json.success) {
    throw new ApiError(
      json.error?.message || `Request failed (${response.status})`,
      json.error?.code || 'UNKNOWN',
      response.status
    )
  }

  return json.data
}

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
