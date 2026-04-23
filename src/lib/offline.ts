/**
 * Offline Sync Queue — public API
 *
 * Dexie-backed mutation queue that:
 *   - Queues failed mutations (POST/PUT/PATCH/DELETE) when offline
 *   - Replays them sequentially (FIFO) when connectivity returns
 *   - Exposes observable state for React via listeners
 *
 * Implementation split across:
 *   - offline.queue.ts     — Dexie DB, listeners, queue CRUD
 *   - offline.processor.ts — sync drain, retry logic, last-sync timestamp
 */

export {
  subscribe,
  enqueue,
  getQueueSnapshot,
  getQueueCounts,
  reactivateBlocked,
  retryItem,
  discardItem,
  discardAllDead,
  recoverStuckItems,
  purgeStaleDead,
} from './offline.queue'

export {
  processQueue,
  isQueueProcessing,
  getLastSyncAt,
} from './offline.processor'
