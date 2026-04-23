import { API_URL, TIMEOUTS } from '@/config/app.config'
import { SYNC_MUTATION_METHODS, SYNC_EXCLUDED_PATHS } from './offline.constants'
import { enqueue } from './offline'
import { readApiCache, writeApiCache } from './api-cache'
import { getCsrfToken, invalidateCsrfToken } from './api-csrf'
import { attemptTokenRefresh } from './api-refresh'

interface ApiOptions extends RequestInit {
  timeout?: number
  /** Skip the 401 refresh interceptor (used by refresh call itself) */
  _skipRefresh?: boolean
  /** Offline queue control. Set false to disable queueing for this call. */
  offlineQueue?: boolean
  /** Human-readable entity type for queue UI (e.g. "party") */
  entityType?: string
  /** Human-readable label for queue UI (e.g. "Raju Traders") */
  entityLabel?: string
  /**
   * Opt-in IDB read cache. When true, successful GET responses are cached
   * and served back when the network is offline. Only set on endpoints
   * whose response is safe to persist for the duration of this user's
   * session (cleared on logout). Default: false — most endpoints stay
   * uncached so PII never leaks across sessions.
   */
  cacheReads?: boolean
}

interface ApiResponse<T> {
  success: boolean
  data: T
  error?: { code: string; message: string }
}

// ─── Main API wrapper ────────────────────────────────────────────────────────

/**
 * Fetch wrapper with timeout, cookie-based auth, abort support,
 * and automatic 401 token refresh with request queue.
 *
 * Auth tokens are stored in httpOnly cookies set by the server.
 * Every request includes `credentials: 'include'` so cookies are sent
 * automatically — no Authorization header needed.
 */
export async function api<T>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const {
    timeout = TIMEOUTS.fetchMs,
    _skipRefresh,
    offlineQueue: oq,
    entityType,
    entityLabel,
    cacheReads,
    ...fetchOptions
  } = options

  const method = (fetchOptions.method ?? 'GET').toUpperCase()
  const shouldQueue = oq !== false
    && SYNC_MUTATION_METHODS.has(method)
    && !SYNC_EXCLUDED_PATHS.some((p) => path.startsWith(p))
  const shouldCacheRead = cacheReads === true && method === 'GET'

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  // CSRF: mutations require X-CSRF-Token header matching csrf-token cookie.
  // Auth endpoints are exempt server-side; skip the roundtrip for them.
  const needsCsrf = SYNC_MUTATION_METHODS.has(method) && !path.startsWith('/auth/')
  const csrf = needsCsrf ? await getCsrfToken() : null

  // Replay protection: server's replayProtection middleware (mounted on documents,
  // payments, etc.) demands a fresh nonce + timestamp on every mutation. Send
  // them on every mutating request so individual services don't need to remember.
  const isMutation = SYNC_MUTATION_METHODS.has(method)
  const replayHeaders: Record<string, string> = isMutation
    ? {
        'X-Request-Nonce': crypto.randomUUID(),
        'X-Request-Timestamp': Date.now().toString(),
      }
    : {}

  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...fetchOptions,
      credentials: 'include',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        ...replayHeaders,
        ...fetchOptions.headers,
      },
    })
  } catch (err) {
    clearTimeout(timeoutId)

    // Network error on a mutation → queue it offline
    if (shouldQueue && isOfflineError(err)) {
      const queued = await enqueue({
        method: method as 'POST' | 'PUT' | 'PATCH' | 'DELETE',
        path,
        body: fetchOptions.body as string | null ?? null,
        createdAt: Date.now(),
        status: 'pending',
        retryCount: 0,
        errorMessage: null,
        entityType: entityType ?? inferEntityType(path),
        entityLabel: entityLabel ?? 'Offline change',
      })
      if (queued) {
        // Return a synthetic empty response — caller treats it as success (optimistic)
        return {} as T
      }
    }

    // Network error on an opt-in read → serve from IDB if we have a fresh entry
    if (shouldCacheRead && isOfflineError(err)) {
      const cached = await readApiCache<T>(path)
      if (cached !== null) return cached
    }

    throw err
  } finally {
    clearTimeout(timeoutId)
  }

  // 401 interceptor — attempt token refresh, then retry the original request
  if (response.status === 401 && !_skipRefresh && !path.includes('/auth/')) {
    const refreshed = await attemptTokenRefresh()
    if (refreshed) {
      return api<T>(path, { ...options, _skipRefresh: true })
    }
    throw new ApiError('Session expired', 'UNAUTHORIZED', 401)
  }

  // 403 CSRF_FAILED — token may be stale (server restart); refresh once and retry
  if (response.status === 403 && needsCsrf && !options._skipRefresh) {
    const body = await response.clone().json().catch(() => null) as { error?: { code?: string } } | null
    if (body?.error?.code === 'CSRF_FAILED') {
      invalidateCsrfToken()
      return api<T>(path, { ...options, _skipRefresh: true })
    }
  }

  // 409 conflict — another user modified the record while offline
  if (response.status === 409) {
    const conflictBody = await response.json().catch(() => null)
    throw new ApiError(
      conflictBody?.error?.message || 'This record was modified by another user. Please refresh and try again.',
      'CONFLICT',
      409
    )
  }

  // 204/205/304 have no body — synthesize success
  const NO_BODY_STATUSES = new Set([204, 205, 304])
  let json: ApiResponse<T>
  if (NO_BODY_STATUSES.has(response.status)) {
    json = { success: true, data: undefined as T }
  } else {
    const rawBody = await response.text().catch(() => '')
    try {
      json = JSON.parse(rawBody) as ApiResponse<T>
    } catch {
      const GATEWAY_ERRORS = new Set([502, 503, 504])
      const snippet = rawBody ? ` [${response.status}: ${rawBody.slice(0, 80)}]` : ` [${response.status}: empty]`
      throw new ApiError(
        GATEWAY_ERRORS.has(response.status)
          ? 'Server is temporarily unavailable — please try again'
          : `Server returned an unexpected response. Please try again.${snippet}`,
        'INVALID_RESPONSE',
        response.status
      )
    }
  }

  if (!response.ok || !json.success) {
    throw new ApiError(
      json.error?.message || `Request failed (${response.status})`,
      json.error?.code || 'UNKNOWN',
      response.status
    )
  }

  // Write-through: persist successful opt-in reads for the next offline pass.
  // Best-effort — quota / private-browsing failures must not break the call.
  if (shouldCacheRead) {
    void writeApiCache(path, json.data)
  }

  return json.data
}

/** Detect network-level failures (no response at all) */
function isOfflineError(err: unknown): boolean {
  if (err instanceof TypeError) return true // fetch throws TypeError on network failure
  if (!navigator.onLine) return true
  return false
}

/** Best-effort entity type from API path (e.g. "/parties/abc" → "party") */
function inferEntityType(path: string): string {
  const segment = path.split('/').filter(Boolean)[0] ?? 'item'
  // Singularise: "parties" → "party", "invoices" → "invoice"
  if (segment.endsWith('ies')) return segment.slice(0, -3) + 'y'
  if (segment.endsWith('s')) return segment.slice(0, -1)
  return segment
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
