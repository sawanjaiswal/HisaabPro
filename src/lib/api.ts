import { API_URL, TIMEOUTS } from '@/config/app.config'
import { SYNC_MUTATION_METHODS, SYNC_EXCLUDED_PATHS } from './offline.constants'
import { enqueue } from './offline'
import { readApiCache, writeApiCache } from './api-cache'
import { invalidateCsrfToken } from './api-csrf'
import { attemptTokenRefresh } from './api-refresh'
import { OFFLINE_MOCK, handleMockRequest, defaultMockResponse, UNHANDLED } from './playstore-mock'
import { getApi403Handler } from './api-pin-gate'
import type { PinRouteClass } from '@/features/pin-gate/pin-gate.types'
import { isOfflineError, inferEntityType } from './api.utils'
import { buildRequestHeaders, isNonRefreshableAuthPath, needsCsrf } from './api-request'
import { parseApiResponse, throwOnConflict } from './api-response'
import { ApiError } from './api-error'
import type { ApiOptions } from './api.types'

// Re-exported so `@/lib/api` stays the single import surface for callers.
export { ApiError }
export type { ApiOptions, ApiResponse } from './api.types'

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

  const isFD = typeof FormData !== 'undefined' && fetchOptions.body instanceof FormData
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...fetchOptions,
      credentials: 'include',
      signal: controller.signal,
      headers: await buildRequestHeaders({
        method,
        path,
        isFormData: isFD,
        entityVersion,
        callerHeaders: fetchOptions.headers,
      }),
    })
  } catch (err) {
    clearTimeout(timeoutId)

    // Timeout — a real failure worth surfacing with a friendly message.
    // The timeout aborts with a reason: DOMException('Request timed out','TimeoutError').
    if (
      err instanceof DOMException &&
      (err.name === 'TimeoutError' || err.message === 'Request timed out')
    ) {
      throw new ApiError('Request timed out — please check your connection and try again', 'TIMEOUT', 0)
    }

    // Genuine cancellation (component unmount, navigation, StrictMode double-invoke)
    // aborts with NO reason → a plain AbortError. Rethrow it UNWRAPPED so every
    // caller's `err.name === 'AbortError'` guard swallows it instead of toasting.
    // Wrapping it in an ApiError (name 'ApiError') was the root cause of the
    // spurious "Request was cancelled" toast.
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err
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
  if (response.status === 403 && needsCsrf(method, path) && !options._skipRefresh) {
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

  await throwOnConflict(response)

  const data = await parseApiResponse<T>(response)

  // Write-through: persist successful opt-in reads for the next offline pass.
  // Best-effort — quota / private-browsing failures must not break the call.
  if (shouldCacheRead) {
    void writeApiCache(path, data)
  }

  return data
}
