/**
 * Response-parsing helpers for `api()` — the 409 branch and the
 * body → `json.data` unwrap.
 *
 * Split out of `api.ts` so that file holds the request lifecycle only.
 * The 401 / 403 interceptors deliberately stay in `api.ts`: they retry by
 * re-entering `api()`, so they belong with the function they recurse into.
 */

import { ApiError } from './api-error'
import type { ApiResponse } from './api.types'

// 204/205/304 carry no body — parsing one would throw on the empty string.
const NO_BODY_STATUSES = new Set([204, 205, 304])
const GATEWAY_ERRORS = new Set([502, 503, 504])

/**
 * 409 conflict — another user modified the record while we were offline, or
 * a stock shortage. Throws when the status matches; returns otherwise.
 */
export async function throwOnConflict(response: Response): Promise<void> {
  if (response.status !== 409) return

  const body = (await response.json().catch(() => null)) as
    | { error?: { code?: string; message?: string; items?: unknown } }
    | null

  throw new ApiError(
    body?.error?.message || 'This record was modified by another user. Please refresh and try again.',
    body?.error?.code ?? 'CONFLICT',
    409,
    body?.error,
  )
}

/**
 * Unwrap the `{ success, data, error }` envelope.
 *
 * A non-JSON body means the request never reached the app (gateway, proxy,
 * HTML error page) — surfaced as INVALID_RESPONSE with a short snippet so the
 * real cause is visible in logs without dumping a whole HTML page into a toast.
 */
export async function parseApiResponse<T>(response: Response): Promise<T> {
  let json: ApiResponse<T>

  if (NO_BODY_STATUSES.has(response.status)) {
    json = { success: true, data: undefined as T }
  } else {
    const rawBody = await response.text().catch(() => '')
    try {
      json = JSON.parse(rawBody) as ApiResponse<T>
    } catch {
      const snippet = rawBody
        ? ` [${response.status}: ${rawBody.slice(0, 80)}]`
        : ` [${response.status}: empty]`
      throw new ApiError(
        GATEWAY_ERRORS.has(response.status)
          ? 'Server is temporarily unavailable — please try again'
          : `Server returned an unexpected response. Please try again.${snippet}`,
        'INVALID_RESPONSE',
        response.status,
      )
    }
  }

  if (!response.ok || !json.success) {
    throw new ApiError(
      json.error?.message || `Request failed (${response.status})`,
      json.error?.code || 'UNKNOWN',
      response.status,
    )
  }

  return json.data
}
