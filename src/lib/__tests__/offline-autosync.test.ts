/**
 * The drain rule is level-triggered: "online AND work pending" must be enough.
 * Requiring an offline→online *edge* is what let a queued party sit forever
 * (.claude/fix-trace-offline-never-drains.md) — the edge fired while the
 * component that owned the listener was unmounted mid-navigation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const online = { value: true }
const listeners = new Set<(o: boolean) => void>()
const counts = { pending: 0, syncing: 0, failed: 0, dead: 0, blocked: 0, total: 0 }
const queueListeners = new Set<() => void>()

vi.mock('@/hooks/useOnlineStatus', () => ({
  getGlobalOnline: () => online.value,
  subscribeOnlineStatus: (l: (o: boolean) => void) => {
    listeners.add(l)
    return () => listeners.delete(l)
  },
}))

vi.mock('../offline.queue', () => ({
  getQueueCounts: async () => counts,
  subscribe: (l: () => void) => {
    queueListeners.add(l)
    return () => queueListeners.delete(l)
  },
}))

const processQueue = vi.fn(async () => {})
vi.mock('../offline.processor', () => ({
  processQueue: () => processQueue(),
  isQueueProcessing: () => false,
}))

const { startOfflineAutoSync, __resetOfflineAutoSyncForTests } = await import('../offline.autosync')

beforeEach(() => {
  processQueue.mockClear()
  listeners.clear()
  queueListeners.clear()
  online.value = true
  Object.assign(counts, { pending: 0, syncing: 0, total: 0 })
  __resetOfflineAutoSyncForTests()
})

describe('startOfflineAutoSync', () => {
  it('drains a queue that is already pending when auto-sync starts, with no online transition', async () => {
    Object.assign(counts, { pending: 1, total: 1 })
    startOfflineAutoSync()
    await vi.waitFor(() => expect(processQueue).toHaveBeenCalledTimes(1))
  })

  it('does not drain when there is nothing queued', async () => {
    startOfflineAutoSync()
    await new Promise((r) => setTimeout(r, 0))
    expect(processQueue).not.toHaveBeenCalled()
  })

  it('does not drain while offline, and drains once connectivity returns', async () => {
    online.value = false
    Object.assign(counts, { pending: 1, total: 1 })
    startOfflineAutoSync()
    await new Promise((r) => setTimeout(r, 0))
    expect(processQueue).not.toHaveBeenCalled()

    online.value = true
    listeners.forEach((l) => l(true))
    await vi.waitFor(() => expect(processQueue).toHaveBeenCalledTimes(1))
  })

  it('drains an item enqueued while already online — no edge is coming', async () => {
    startOfflineAutoSync()
    await new Promise((r) => setTimeout(r, 0))

    Object.assign(counts, { pending: 1, total: 1 })
    queueListeners.forEach((l) => l())
    await vi.waitFor(() => expect(processQueue).toHaveBeenCalledTimes(1))
  })

  it('is idempotent — starting twice keeps a single set of subscriptions', () => {
    startOfflineAutoSync()
    startOfflineAutoSync()
    expect(listeners.size).toBe(1)
    expect(queueListeners.size).toBe(1)
  })
})
