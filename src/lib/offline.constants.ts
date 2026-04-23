/** Offline sync queue — configuration constants */

/** Maximum items in the queue before rejecting new entries */
export const SYNC_QUEUE_MAX_SIZE = 100

/** Maximum retry attempts before marking an item as dead */
export const SYNC_QUEUE_MAX_RETRIES = 3

/** Exponential backoff delays in ms: 1s, 3s, 9s */
export const SYNC_RETRY_DELAYS = [1_000, 3_000, 9_000] as const

/** Paths that must never be queued (auth, health) */
export const SYNC_EXCLUDED_PATHS = ['/auth/'] as const

/** HTTP methods that qualify as mutations (queueable) */
export const SYNC_MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** Dexie database name */
export const SYNC_DB_NAME = 'hisaabpro-sync'

/** Dexie database version */
export const SYNC_DB_VERSION = 1

/**
 * TTL for items in the `dead` status (ms). Auto-purged on next queue run.
 * Stops permanently-failed mutations from accumulating IndexedDB quota.
 * 30 days is long enough that the user can review failures during their
 * next online session, short enough that abandoned drafts don't pile up.
 */
export const SYNC_DEAD_TTL_MS = 30 * 24 * 60 * 60 * 1_000
