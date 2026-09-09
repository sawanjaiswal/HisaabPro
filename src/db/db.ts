// Canonical offline store (Dexie) for HisaabPro.
//
// Tables:
// - outbox: Queued mutations awaiting sync with the backend.
// - metadata: Generic KV store (id maps, sync watermarks, etc.).
// - readCache: Multi-tiered local-first read cache (compound PK [scope+key]).
// - attachmentBlobs: Locally captured media or document blobs awaiting upload.
//
// Domain tables are added via additive Dexie version bumps, never by editing
// an existing version's schema.
import Dexie, { type EntityTable, type Table } from 'dexie'

export type OutboxStatus = 'PENDING' | 'IN_FLIGHT' | 'FAILED'
export type OutboxOp = 'create' | 'update' | 'delete'

/** A queued mutation awaiting sync to the server. */
export interface OutboxEntry {
  id: string
  /** Domain noun this write targets (e.g. 'invoice', 'party', 'payment', 'product'). */
  entity: string
  op: OutboxOp
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** Endpoint; may contain a `:id` template resolved at drain time. */
  url: string
  body: unknown
  idempotencyKey: string
  /** Optimistic id the local row was written under (create/update). */
  tempId?: string
  /** Known server id (update/delete of an already-synced row). */
  serverId?: string
  status: OutboxStatus
  /** Lower drains earlier; default 100. */
  priority: number
  createdAt: number
  updatedAt: number
  attempts: number
  lastError?: { status: number; code?: string; message?: string }
}

/** Generic KV row — persisted id-map, sync markers, preferences. */
export interface MetadataEntry {
  key: string
  value: unknown
}

/** A locally-captured invoice attachment or receipt photo awaiting upload. */
export interface AttachmentBlobEntry {
  id: string
  businessId: string
  blob: Blob
  mime: string
  createdAt: number
  uploaded: boolean
  lost?: boolean
}

/** Local-first read cache entry (T1 Dexie tier). */
export interface ReadCacheEntry {
  scope: string         // 'business:<id>' | 'global' | 'user' — the eviction unit
  key: string           // 'invoices:list:<filterHash>' — query identity
  value: unknown        // parsed payload
  fetchedAt: number     // epoch ms; drives TTL + STALE badge
  schemaVersion: number // bump to invalidate changed shapes
}

const db = new Dexie('HisaabPro') as Dexie & {
  outbox: EntityTable<OutboxEntry, 'id'>
  metadata: EntityTable<MetadataEntry, 'key'>
  attachmentBlobs: Table<AttachmentBlobEntry, [string, string]>
  readCache: Table<ReadCacheEntry, [string, string]>
}

// v1 — Core offline-first schema
db.version(1).stores({
  outbox: 'id, entity, status, priority, createdAt, [status+priority]',
  metadata: 'key',
  attachmentBlobs: '[businessId+id], businessId, uploaded, lost',
  readCache: '[scope+key], scope, fetchedAt',
})

export { db }
