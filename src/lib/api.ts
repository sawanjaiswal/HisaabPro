import { API_URL, TIMEOUTS } from '@/config/app.config'
import { SYNC_MUTATION_METHODS, SYNC_EXCLUDED_PATHS } from './offline.constants'
import { enqueue } from './offline'
import { readApiCache, writeApiCache } from './api-cache'
import { getCsrfToken, invalidateCsrfToken } from './api-csrf'
import { attemptTokenRefresh } from './api-refresh'
import { OFFLINE_MOCK, handleMockRequest, defaultMockResponse, UNHANDLED } from './playstore-mock'
import { getApi403Handler } from './api-pin-gate'
import type { PinRouteClass } from '@/features/pin-gate/pin-gate.types'
import { isOfflineError, inferEntityType } from './api.utils'

interface ApiOptions extends RequestInit {
  timeout?: number
  /** Skip the 401 refresh interceptor (used by refresh call itself) */
  _skipRefresh?: boolean
  /**
   * Skip the 403 PIN_REQUIRED interceptor. Set by the PIN-verify retry path
   * and by the PIN-verify call itself to prevent infinite loops (the
   * interceptor would otherwise re-prompt for PIN on the PIN-prompt's own
   * 401/429 response).
   */
  _skipPin?: boolean
  /** Offline queue control. Set false to disable queueing for this call. */
  offlineQueue?: boolean
  /** Human-readable entity type for queue UI (e.g. "party") */
  entityType?: string
  /** Human-readable label for queue UI (e.g. "Raju Traders") */
  entityLabel?: string
  /** Opt-in IDB read cache for safe-to-persist GETs. Cleared on logout. Default: false. */
  cacheReads?: boolean
  /** #150 optimistic lock — last-read entity version; sent as X-Entity-Version (stale → 409 CONFLICT). */
  entityVersion?: number
}

interface ApiResponse<T> {
  success: boolean
  data: T
  error?: { code: string; message: string }
}

// Endpoints where a 401 means "these credentials/tokens are invalid," not
// "the access token merely expired" — attempting a refresh here would either
// recurse (refresh calling itself) or mask a genuine auth failure as a retry.
// Every other path (including /auth/me, /auth/logout, /auth/switch-business)
// goes through the normal refresh-and-retry interceptor.
const NON_REFRESHABLE_AUTH_PATHS = [
  '/auth/login',
  '/auth/dev-login',
  '/auth/refresh',
  '/auth/register',
  '/auth/verify-registration',
  '/auth/verify-otp',
]

function isNonRefreshableAuthPath(path: string): boolean {
  return NON_REFRESHABLE_AUTH_PATHS.some((p) => path.startsWith(p))
}

/** Fetch wrapper: timeout + httpOnly-cookie auth + abort + 401 refresh + 403 PIN gate + offline queue + opt-in IDB read cache. */
export async function api<T>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const {
    timeout = TIMEOUTS.fetchMs,
    _skipRefresh,
    _skipPin,
    offlineQueue: oq,
    entityType,
    entityLabel,
    cacheReads,
    entityVersion,
    ...fetchOptions
  } = options

  const method = (fetchOptions.method ?? 'GET').toUpperCase()

  // Play Store closed-testing build — short-circuit every call to the in-memory
  // mock layer. No network, no backend, fully usable without internet.
  if (OFFLINE_MOCK) {
    const mocked = handleMockRequest(method, path, fetchOptions.body as BodyInit | null | undefined)
    if (mocked === UNHANDLED) return defaultMockResponse(method) as T
    return mocked as T
  }

  const shouldQueue = oq !== false
    && SYNC_MUTATION_METHODS.has(method)
    && !SYNC_EXCLUDED_PATHS.some((p) => path.startsWith(p))
  const shouldCacheRead = cacheReads === true && method === 'GET'

  const controller = new AbortController()
  const timeoutId = setTimeout(
    () => controller.abort(new DOMException('Request timed out', 'TimeoutError')),
    timeout,
  )

  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  // CSRF: mutations require X-CSRF-Token header matching csrf-token cookie.
  // Auth endpoints are exempt server-side; skip the roundtrip for them.
  const needsCsrf = SYNC_MUTATION_METHODS.has(method) && !path.startsWith('/auth/')
  const csrf = needsCsrf ? await getCsrfToken() : null

  // Replay protection: replayProtection middleware demands a fresh nonce +
  // timestamp on every mutation — send them so services don't need to remember.
  const isMutation = SYNC_MUTATION_METHODS.has(method)
  const replayHeaders: Record<string, string> = isMutation
    ? {
        'X-Request-Nonce': crypto.randomUUID(),
        'X-Request-Timestamp': Date.now().toString(),
      }
    : {}

  const isFD = typeof FormData !== 'undefined' && fetchOptions.body instanceof FormData
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...fetchOptions,
      credentials: 'include',
      signal: controller.signal,
      headers: {
        ...(isFD ? {} : { 'Content-Type': 'application/json' }),
        ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        ...replayHeaders,
        ...(entityVersion !== undefined ? { 'X-Entity-Version': String(entityVersion) } : {}), // #150 optimistic lock
        ...fetchOptions.headers,
      },
    })
  } catch (err) {
    clearTimeout(timeoutId)

    // Timeout or intentional abort — surface a clear message instead of the raw DOM string
    if (err instanceof DOMException && err.name === 'AbortError') {
      const isTimeout = err.message === 'Request timed out'
      throw new ApiError(
        isTimeout
          ? 'Request timed out — please check your connection and try again'
          : 'Request was cancelled',
        isTimeout ? 'TIMEOUT' : 'ABORTED',
        0,
      )
    }

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

  // 401 interceptor — attempt token refresh, then retry the original request.
  // Only credential-verification endpoints are excluded (a 401 there means
  // "bad credentials", not "access token expired") — every other endpoint,
  // including /auth/me, /auth/logout, /auth/switch-business, goes through
  // the refresh-and-retry path so an expired 15m access token doesn't force
  // a hard logout while the refresh-token cookie is still valid.
  if (response.status === 401 && !_skipRefresh && !isNonRefreshableAuthPath(path)) {
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

  // 403 PIN_REQUIRED — PinGateProvider opens the PinPadSheet, verifies the
  // PIN (server sets fresh pin_gate_grace cookie), then retries this request.
  // _skipPin guards the verify call + inner retry from recursing here.
  if (response.status === 403 && !_skipPin) {
    const pinBody = await response.clone().json().catch(() => null) as
      { error?: { code?: string; routeClass?: string } } | null
    if (pinBody?.error?.code === 'PIN_REQUIRED') {
      const handler = getApi403Handler()
      if (handler) {
        const routeClass = (pinBody.error.routeClass as PinRouteClass | undefined) ?? 'mutation'
        return handler<T>(() => api<T>(path, { ...options, _skipPin: true }), routeClass)
      }
    }
  }

  // 409 conflict — another user modified the record while offline, or stock shortage
  if (response.status === 409) {
    const conflictBody = await response.json().catch(() => null) as { error?: { code?: string; message?: string; items?: unknown } } | null
    const errCode = conflictBody?.error?.code ?? 'CONFLICT'
    throw new ApiError(
      conflictBody?.error?.message || 'This record was modified by another user. Please refresh and try again.',
      errCode,
      409,
      conflictBody?.error,
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

export class ApiError extends Error {
  public detail?: unknown // e.g. INSUFFICIENT_STOCK items array
  constructor(message: string, public code: string, public status: number, detail?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.detail = detail
  }
}
