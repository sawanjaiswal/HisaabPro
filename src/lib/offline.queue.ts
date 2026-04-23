/**
 * Offline Queue — Dexie DB + CRUD operations
 *
 * Internal module — import from `@/lib/offline` (the public API).
 */

import Dexie from 'dexie'
import {
  SYNC_DB_NAME,
  SYNC_DB_VERSION,
  SYNC_DEAD_TTL_MS,
  SYNC_QUEUE_MAX_SIZE,
} from './offline.constants'
import type { SyncQueueItem, SyncItemStatus } from './offline.types'

// ─── Dexie Database ──────────────────────────────────────────────────────────

class SyncDB extends Dexie {
  syncQueue!: Dexie.Table<SyncQueueItem, number>

  constructor() {
    super(SYNC_DB_NAME)
    this.version(SYNC_DB_VERSION).stores({
      syncQueue: '++id, status, createdAt',
    })
  }
}

export const db = new SyncDB()

// ─── State listeners (React subscribes here) ─────────────────────────────────

type SyncStateListener = () => void
const listeners = new Set<SyncStateListener>()

export function notify(): void {
  listeners.forEach((fn) => fn())
}

export function subscribe(listener: SyncStateListener): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

// ─── Queue CRUD ───────────────────────────────────────────────────────────────

export async function enqueue(item: Omit<SyncQueueItem, 'id'>): Promise<boolean> {
  const count = await db.syncQueue.count()
  if (count >= SYNC_QUEUE_MAX_SIZE) return false
  await db.syncQueue.add(item as SyncQueueItem)
  notify()
  return true
}

export async function getQueueSnapshot(): Promise<SyncQueueItem[]> {
  return db.syncQueue.orderBy('createdAt').toArray()
}

export async function getQueueCounts(): Promise<{
  pending: number
  syncing: number
  failed: number
  dead: number
  blocked: number
  total: number
}> {
  const all = await db.syncQueue.toArray()
  const counts = { pending: 0, syncing: 0, failed: 0, dead: 0, blocked: 0, total: all.length }
  for (const item of all) {
    if (item.status in counts) {
      counts[item.status as keyof Omit<typeof counts, 'total'>]++
    }
  }
  return counts
}

/** Reactivate all `blocked` items — call after user upgrades their plan. */
export async function reactivateBlocked(): Promise<number> {
  const blocked = await db.syncQueue.where('status').equals('blocked').toArray()
  if (blocked.length === 0) return 0
  await db.syncQueue
    .where('status')
    .equals('blocked')
    .modify({ status: 'pending' as SyncItemStatus, retryCount: 0, errorMessage: null })
  notify()
  return blocked.length
}

export async function retryItem(id: number): Promise<void> {
  await db.syncQueue.update(id, { status: 'pending' as SyncItemStatus, retryCount: 0, errorMessage: null })
  notify()
}

export async function discardItem(id: number): Promise<void> {
  await db.syncQueue.delete(id)
  notify()
}

export async function discardAllDead(): Promise<void> {
  await db.syncQueue.where('status').equals('dead').delete()
  notify()
}

// ─── Crash recovery — reset stuck `syncing` items on startup ──────────────────

export async function recoverStuckItems(): Promise<void> {
  const stuck = await db.syncQueue.where('status').equals('syncing').toArray()
  if (stuck.length === 0) return
  await db.syncQueue
    .where('status')
    .equals('syncing')
    .modify({ status: 'pending' as SyncItemStatus })
  notify()
}

/**
 * Purge `dead` items older than SYNC_DEAD_TTL_MS. Runs at the top of every
 * queue pass so dead-letter rows can't pile up across long offline stretches.
 * Returns number of rows deleted (for diagnostics).
 */
export async function purgeStaleDead(): Promise<number> {
  const cutoff = Date.now() - SYNC_DEAD_TTL_MS
  const removed = await db.syncQueue
    .where('status')
    .equals('dead')
    .filter((item) => item.createdAt < cutoff)
    .delete()
  if (removed > 0) notify()
  return removed
}
