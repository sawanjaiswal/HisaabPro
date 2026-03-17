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
