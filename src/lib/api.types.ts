/**
 * Types for the `api()` fetch wrapper (`src/lib/api.ts`).
 *
 * Split out so `api.ts` holds request orchestration only. Nothing here has a
 * runtime footprint — types plus the option contract every caller reads.
 */

export interface ApiOptions extends RequestInit {
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

export interface ApiResponse<T> {
  success: boolean
  data: T
  error?: { code: string; message: string }
}
