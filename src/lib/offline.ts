/**
 * Offline Sync Queue — Dexie-backed mutation queue
 *
 * Queues failed mutations (POST/PUT/PATCH/DELETE) when offline.
 * Replays them sequentially (FIFO) when connectivity returns.
 * Exposes observable state for React via listeners.
 */

import Dexie from 'dexie'
import { API_URL, TIMEOUTS } from '@/config/app.config'
import {
  SYNC_DB_NAME,
  SYNC_DB_VERSION,
  SYNC_QUEUE_MAX_SIZE,
  SYNC_QUEUE_MAX_RETRIES,
  SYNC_RETRY_DELAYS,
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

const db = new SyncDB()

// ─── State listeners (React subscribes here) ────────────────────────────────

type SyncStateListener = () => void
const listeners = new Set<SyncStateListener>()

function notify(): void {
  listeners.forEach((fn) => fn())
}

export function subscribe(listener: SyncStateListener): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

// ─── Queue CRUD ──────────────────────────────────────────────────────────────

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

// ─── Crash recovery — reset stuck `syncing` items on startup ─────────────────

export async function recoverStuckItems(): Promise<void> {
  const stuck = await db.syncQueue.where('status').equals('syncing').toArray()
  if (stuck.length === 0) return
  await db.syncQueue
    .where('status')
    .equals('syncing')
    .modify({ status: 'pending' as SyncItemStatus })
  notify()
}

// ─── Sync Processor ──────────────────────────────────────────────────────────

let isProcessing = false

export function isQueueProcessing(): boolean {
  return isProcessing
}

/**
 * Process the queue sequentially (FIFO).
 * Call this when the app comes online.
 * Stops on auth errors (401) — user needs to re-authenticate first.
 */
export async function processQueue(): Promise<void> {
  if (isProcessing) return
  isProcessing = true
  notify()

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const next = await db.syncQueue
        .where('status')
        .equals('pending')
        .sortBy('createdAt')
        .then((items) => items[0])

      if (!next || !next.id) break

      // Mark syncing
      await db.syncQueue.update(next.id, { status: 'syncing' as SyncItemStatus })
      notify()

      try {
        const response = await fetch(`${API_URL}${next.path}`, {
          method: next.method,
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: next.body,
          signal: AbortSignal.timeout(TIMEOUTS.fetchMs),
        })

        if (response.ok) {
          // Success — remove from queue
          await db.syncQueue.delete(next.id)
          notify()
          continue
        }

        // Auth error — stop processing, don't count as item failure
        if (response.status === 401) {
          await db.syncQueue.update(next.id, { status: 'pending' as SyncItemStatus })
          notify()
          break
        }

        // 402 UPGRADE_REQUIRED — plan lapsed since queuing. Preserve item so it
        // can replay after the user upgrades; surface via `blocked` status.
        if (response.status === 402) {
          const errMsg = await extractErrorMessage(response)
          await db.syncQueue.update(next.id, {
            status: 'blocked' as SyncItemStatus,
            errorMessage: errMsg,
          })
          notify()
          continue
        }

        // Other client errors (4xx) — data is invalid, mark dead immediately
        if (response.status >= 400 && response.status < 500) {
          const errMsg = await extractErrorMessage(response)
          await db.syncQueue.update(next.id, {
            status: 'dead' as SyncItemStatus,
            errorMessage: errMsg,
          })
          notify()
          continue
        }

        // Server error (5xx) — retry with backoff
        await handleRetry(next, await extractErrorMessage(response))
      } catch (err) {
        // Network error — stop processing (still offline)
        const msg = err instanceof Error ? err.message : 'Network error'
        if (isNetworkError(err)) {
          await db.syncQueue.update(next.id, { status: 'pending' as SyncItemStatus })
          notify()
          break
        }
        // Timeout or other — retry
        await handleRetry(next, msg)
      }
    }
  } finally {
    isProcessing = false
    notify()
  }
}

async function handleRetry(item: SyncQueueItem, errorMessage: string): Promise<void> {
  const nextRetry = item.retryCount + 1
  if (nextRetry >= SYNC_QUEUE_MAX_RETRIES) {
    await db.syncQueue.update(item.id!, {
      status: 'dead' as SyncItemStatus,
      retryCount: nextRetry,
      errorMessage,
    })
  } else {
    await db.syncQueue.update(item.id!, {
      status: 'pending' as SyncItemStatus,
      retryCount: nextRetry,
      errorMessage,
    })
    // Wait backoff before next iteration picks it up
    const delay = SYNC_RETRY_DELAYS[Math.min(nextRetry - 1, SYNC_RETRY_DELAYS.length - 1)]
    await sleep(delay)
  }
  notify()
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const json = await response.json()
    return json?.error?.message || `Server error (${response.status})`
  } catch {
    return `Server error (${response.status})`
  }
}

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError && err.message.includes('fetch')) return true
  if (err instanceof DOMException && err.name === 'AbortError') return false
  if (err instanceof Error && ['ECONNREFUSED', 'ENOTFOUND', 'ERR_NETWORK'].some((c) => err.message.includes(c))) return true
  return !navigator.onLine
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
