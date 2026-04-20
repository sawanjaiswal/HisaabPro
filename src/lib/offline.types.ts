/** Offline sync queue — type definitions */

/**
 * `blocked` — server returned 402 UPGRADE_REQUIRED during replay. Item is
 * preserved (not discarded) so it can be retried after upgrade.
 */
export type SyncItemStatus = 'pending' | 'syncing' | 'failed' | 'dead' | 'blocked'

export type SyncHttpMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface SyncQueueItem {
  /** Auto-incremented by Dexie */
  id?: number
  method: SyncHttpMethod
  /** API path (e.g. `/parties/abc123`) */
  path: string
  /** JSON-serialised request body (null for DELETE) */
  body: string | null
  /** Unix timestamp ms — when queued */
  createdAt: number
  status: SyncItemStatus
  retryCount: number
  /** Last error message from failed attempt */
  errorMessage: string | null
  /** Human label: "party", "invoice", "payment", "product" */
  entityType: string
  /** Display name: "Raju Traders", "INV-0042" */
  entityLabel: string
}

/** Options passed to `api()` to control offline queueing */
export interface OfflineQueueMeta {
  /** Set false to skip offline queueing (e.g. auth calls). Default: true for mutations. */
  offlineQueue?: boolean
  /** Human-readable entity type for the queue UI */
  entityType?: string
  /** Human-readable label for the queue UI */
  entityLabel?: string
}
