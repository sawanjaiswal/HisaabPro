/**
 * Offline queue replay — end-to-end (P1.3, GOLD_STANDARD).
 *
 * Closes the gap named in P1.3: "no test queues a mutation offline → goes online
 * → asserts single application". Drives the real `processQueue` from
 * `offline.processor.ts` against an in-memory stand-in for the Dexie queue (jsdom
 * has no IndexedDB, and mocking the table keeps the test dependency-free) and a
 * recording `fetch`. What it proves:
 *
 *   - FIFO single-application: three offline mutations replay exactly once each,
 *     in createdAt order, each POST carrying an idempotency key, queue drained.
 *   - Idempotency-key STABILITY: a pre-keyed item replays with that exact key,
 *     never a fresh one — so a server that already saw the key dedupes correctly.
 *   - Double-replay is a no-op: the queue is the source of truth, applied items
 *     are deleted, so a second pass sends nothing new.
 *   - 401 halts the pass and preserves order (re-auth, then resume) — no item is
 *     skipped or dead-lettered by an auth failure.
 *   - A 4xx dead-letters the item and fires the replay-rejection bridge once.
 *
 * The "correct GL / server-side single application" half of P1.3 belongs to a
 * live-server integration test; this file owns the client replay contract.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { SyncQueueItem } from '../offline.types'

// Shared in-memory store — hoisted so the vi.mock factory and the test body see
// the same array. Mirrors only the Dexie surface processQueue actually calls.
const store = vi.hoisted(() => {
  const items: SyncQueueItem[] = []
  return {
    items,
    reset() {
      items.length = 0
    },
    seed(partial: Partial<SyncQueueItem>): SyncQueueItem {
      const item: SyncQueueItem = {
        id: items.length ? Math.max(...items.map((i) => i.id!)) + 1 : 1,
        method: 'POST',
        path: '/parties',
        body: '{}',
        createdAt: items.length,
        status: 'pending',
        retryCount: 0,
        errorMessage: null,
        entityType: 'party',
        entityLabel: 'Test',
        ...partial,
      }
      items.push(item)
      return item
    },
  }
})

vi.mock('../offline.queue', () => {
  const table = {
    where: (field: keyof SyncQueueItem) => ({
      equals: (val: unknown) => ({
        sortBy: async (sortField: keyof SyncQueueItem) =>
          store.items
            .filter((i) => i[field] === val)
            .sort((a, b) => Number(a[sortField]) - Number(b[sortField])),
      }),
    }),
    update: async (id: number, patch: Partial<SyncQueueItem>) => {
      const it = store.items.find((i) => i.id === id)
      if (it) Object.assign(it, patch)
    },
    delete: async (id: number) => {
      const idx = store.items.findIndex((i) => i.id === id)
      if (idx >= 0) store.items.splice(idx, 1)
    },
    count: async () => store.items.length,
  }
  return { db: { syncQueue: table }, notify: () => {}, purgeStaleDead: async () => 0 }
})

// Real CSRF fetching would add an untracked GET to the recorded calls; the
// token's provenance is api.ts's concern, not the replayer's.
vi.mock('../api-csrf', () => ({
  getCsrfToken: async () => 'test-csrf-token',
  invalidateCsrfToken: () => {},
}))

const replayRejection = vi.fn()
vi.mock('../api-queue-replay', () => ({
  notifyReplayRejection: (...a: unknown[]) => replayRejection(...a),
}))

import { processQueue } from '../offline.processor'

type FetchCall = {
  url: string
  method: string
  key: string | undefined
  headers: Record<string, string>
}
let calls: FetchCall[]

function mockFetch(responder: (call: FetchCall, n: number) => { ok: boolean; status: number }) {
  let n = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, opts: RequestInit) => {
      const headers = (opts.headers ?? {}) as Record<string, string>
      const call: FetchCall = {
        url,
        method: opts.method!,
        key: headers['X-Idempotency-Key'],
        headers,
      }
      calls.push(call)
      const { ok, status } = responder(call, n++)
      return {
        ok,
        status,
        json: async () => ({ error: { message: `err ${status}` } }),
      } as Response
    }),
  )
}

beforeEach(() => {
  store.reset()
  calls = []
  replayRejection.mockReset()
})

describe('offline replay — single application + FIFO', () => {
  it('replays three offline mutations exactly once, in createdAt order, then drains', async () => {
    store.seed({ path: '/parties', createdAt: 1, entityType: 'party' })
    store.seed({ path: '/invoices', createdAt: 2, entityType: 'invoice' })
    store.seed({ path: '/payments', createdAt: 3, entityType: 'payment' })

    mockFetch(() => ({ ok: true, status: 200 }))
    await processQueue()

    expect(calls.map((c) => c.url)).toEqual(['/api/parties', '/api/invoices', '/api/payments'])
    // Every replayed POST carries an idempotency key (server-side dedupe hook).
    expect(calls.every((c) => typeof c.key === 'string' && c.key.length > 0)).toBe(true)
    // Single application: the queue is empty, nothing left to re-send.
    expect(store.items).toHaveLength(0)
  })

  it('reuses a pre-assigned idempotency key rather than minting a fresh one', async () => {
    store.seed({ path: '/payments', idempotencyKey: 'stable-key-123', entityType: 'payment' })
    mockFetch(() => ({ ok: true, status: 200 }))
    await processQueue()
    expect(calls).toHaveLength(1)
    expect(calls[0].key).toBe('stable-key-123')
  })
})

describe('offline replay — idempotency on double replay', () => {
  it('a second pass over a drained queue sends nothing new', async () => {
    store.seed({ path: '/parties' })
    store.seed({ path: '/invoices' })
    mockFetch(() => ({ ok: true, status: 200 }))

    await processQueue()
    expect(calls).toHaveLength(2)
    expect(store.items).toHaveLength(0)

    await processQueue() // online again, queue already empty
    expect(calls).toHaveLength(2) // no additional fetches
  })
})

describe('offline replay — failure handling', () => {
  it('401 halts the pass, re-queues the item, and preserves the rest in order', async () => {
    store.seed({ path: '/parties', createdAt: 1 })
    store.seed({ path: '/invoices', createdAt: 2 })
    store.seed({ path: '/payments', createdAt: 3 })

    mockFetch((_c, n) => (n === 0 ? { ok: false, status: 401 } : { ok: true, status: 200 }))
    await processQueue()

    // Stopped after the first request; nothing dead-lettered, nothing skipped.
    expect(calls).toHaveLength(1)
    expect(store.items).toHaveLength(3)
    expect(store.items.every((i) => i.status === 'pending')).toBe(true)
    // FIFO intact: the halted item is still first by createdAt.
    expect([...store.items].sort((a, b) => a.createdAt - b.createdAt)[0].path).toBe('/parties')
  })

  it('a 4xx dead-letters the item and fires the replay-rejection bridge once', async () => {
    store.seed({ path: '/invoices', entityType: 'invoice', entityLabel: 'INV-1' })
    mockFetch(() => ({ ok: false, status: 400 }))
    await processQueue()

    expect(calls).toHaveLength(1)
    expect(store.items).toHaveLength(1)
    expect(store.items[0].status).toBe('dead')
    expect(replayRejection).toHaveBeenCalledTimes(1)
    expect(replayRejection.mock.calls[0][0]).toMatchObject({ entityType: 'invoice', status: 400 })
  })
})

describe('offline replay — request headers', () => {
  it('replays with the CSRF token and replay-protection headers the live client sends', async () => {
    // Without these the server answers 403 CSRF_FAILED / 400
    // MISSING_REQUEST_HEADERS, which the processor treats as a non-retryable
    // 4xx — so every mutation made offline is dead-lettered on reconnect and
    // the user's work is silently lost.
    store.seed({ path: '/parties', createdAt: 1 })
    mockFetch(() => ({ ok: true, status: 200 }))

    await processQueue()

    const [{ headers }] = calls
    expect(headers['X-CSRF-Token']).toBe('test-csrf-token')
    expect(headers['X-Request-Nonce']).toBeTruthy()
    expect(headers['X-Request-Timestamp']).toBeTruthy()
    expect(headers['Content-Type']).toBe('application/json')
  })
})
