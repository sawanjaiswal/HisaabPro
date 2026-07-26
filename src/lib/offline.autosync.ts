/**
 * Offline auto-sync — owns the answer to "when does the queue drain?".
 *
 * The rule is a *level*, not an *edge*: whenever the app is online and the
 * queue holds work, drain it. Owning that here (started once at boot, never
 * unmounted) rather than in a component means a save-then-navigate cannot lose
 * the moment connectivity returns — which is exactly how a queued party used to
 * sit `pending` forever. See .claude/fix-trace-offline-never-drains.md.
 *
 * Internal module — import from `@/lib/offline` (the public API).
 */

import { getGlobalOnline, subscribeOnlineStatus } from '@/hooks/useOnlineStatus'
import { getQueueCounts, subscribe } from './offline.queue'
import { isQueueProcessing, processQueue } from './offline.processor'

let unsubscribers: Array<() => void> = []

/** Drain only when there is something to drain — the level, evaluated fresh. */
async function drainIfWork(): Promise<void> {
  if (!getGlobalOnline() || isQueueProcessing()) return
  const counts = await getQueueCounts()
  if (counts.pending + counts.syncing === 0) return
  await processQueue()
}

/**
 * Start watching for drainable work. Idempotent: calling it twice keeps one
 * set of subscriptions, so a re-executed module (HMR, tests) cannot stack them.
 */
export function startOfflineAutoSync(): void {
  if (unsubscribers.length > 0) return

  unsubscribers = [
    // Connectivity returned.
    subscribeOnlineStatus((online) => {
      if (online) void drainIfWork()
    }),
    // The queue changed. Covers the case with no edge coming at all: a single
    // request failing while the heartbeat still reports "online" enqueues an
    // item that no online transition will ever pick up.
    subscribe(() => {
      void drainIfWork()
    }),
  ]

  // Boot: a queue left over from the previous session is work in hand.
  void drainIfWork()
}

/** Test-only — releases the subscriptions so each case starts clean. */
export function __resetOfflineAutoSyncForTests(): void {
  unsubscribers.forEach((off) => off())
  unsubscribers = []
}
