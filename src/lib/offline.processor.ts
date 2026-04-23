/**
 * Offline Sync Processor — replays queued mutations when connectivity returns.
 *
 * Internal module — import from `@/lib/offline` (the public API).
 */

import { API_URL, TIMEOUTS } from '@/config/app.config'
import { SYNC_QUEUE_MAX_RETRIES, SYNC_RETRY_DELAYS } from './offline.constants'
import type { SyncQueueItem, SyncItemStatus } from './offline.types'
import { db, notify, purgeStaleDead } from './offline.queue'

// ─── Last-sync timestamp ──────────────────────────────────────────────────────

const LAST_SYNC_KEY = 'hisaabpro:lastSyncAt'

export function getLastSyncAt(): number | null {
  try {
    const raw = localStorage.getItem(LAST_SYNC_KEY)
    if (!raw) return null
    const n = Number.parseInt(raw, 10)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

function setLastSyncAt(ts: number): void {
  try { localStorage.setItem(LAST_SYNC_KEY, String(ts)) } catch { /* private mode */ }
}

// ─── Processing state ─────────────────────────────────────────────────────────

let isProcessing = false

export function isQueueProcessing(): boolean {
  return isProcessing
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    const delay = SYNC_RETRY_DELAYS[Math.min(nextRetry - 1, SYNC_RETRY_DELAYS.length - 1)]
    await sleep(delay)
  }
  notify()
}

// ─── Queue Processor ──────────────────────────────────────────────────────────

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
    await purgeStaleDead().catch(() => {})

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const next = await db.syncQueue
        .where('status')
        .equals('pending')
        .sortBy('createdAt')
        .then((items) => items[0])

      if (!next || !next.id) break

      let current = next
      if (next.method === 'POST' && !next.idempotencyKey) {
        const key = crypto.randomUUID()
        await db.syncQueue.update(next.id, { idempotencyKey: key })
        current = { ...next, idempotencyKey: key }
      }

      await db.syncQueue.update(next.id, { status: 'syncing' as SyncItemStatus })
      notify()

      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (current.idempotencyKey) headers['X-Idempotency-Key'] = current.idempotencyKey

        const response = await fetch(`${API_URL}${current.path}`, {
          method: current.method,
          credentials: 'include',
          headers,
          body: current.body,
          signal: AbortSignal.timeout(TIMEOUTS.fetchMs),
        })

        if (response.ok) {
          await db.syncQueue.delete(next.id)
          notify()
          continue
        }

        if (response.status === 401) {
          await db.syncQueue.update(next.id, { status: 'pending' as SyncItemStatus })
          notify()
          break
        }

        if (response.status === 402) {
          const errMsg = await extractErrorMessage(response)
          await db.syncQueue.update(next.id, {
            status: 'blocked' as SyncItemStatus,
            errorMessage: errMsg,
          })
          notify()
          continue
        }

        if (response.status >= 400 && response.status < 500) {
          const errMsg = await extractErrorMessage(response)
          await db.syncQueue.update(next.id, {
            status: 'dead' as SyncItemStatus,
            errorMessage: errMsg,
          })
          notify()
          continue
        }

        await handleRetry(next, await extractErrorMessage(response))
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Network error'
        if (isNetworkError(err)) {
          await db.syncQueue.update(next.id, { status: 'pending' as SyncItemStatus })
          notify()
          break
        }
        await handleRetry(next, msg)
      }
    }
  } finally {
    const remaining = await db.syncQueue.count().catch(() => 0)
    if (remaining === 0) setLastSyncAt(Date.now())
    isProcessing = false
    notify()
  }
}
