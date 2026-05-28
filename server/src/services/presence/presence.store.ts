// #150 Presence store — in-memory, single-instance.
//
// SINGLE-INSTANCE ONLY. Render runs HisaabPro as one web instance, so a process
// Map is correct today. If the service is ever scaled horizontally, presence
// becomes per-instance and peers on different instances won't see each other —
// the loud guard below fires, and the Redis pub/sub seam (FUTURE_EPIC) must
// land before scaling. Until then this is intentionally simple.
import logger from '../../lib/logger.js'
import type { PresenceEntry, PresenceEntityType, Peer } from './presence.types.js'

const TTL_MS = 45_000 // entry expires 45s after the last heartbeat (client beats every 20s)
const SWEEP_MS = 30_000

// businessId -> userId -> entry. Keying by userId caps each user to ONE active
// focus, so the store can't grow unbounded from a single client (sec S2).
const store = new Map<string, Map<string, PresenceEntry>>()

// One-time loud guard: multi-instance defeats the in-process Map.
if (Number(process.env.WEB_CONCURRENCY ?? '1') > 1 || Number(process.env.NODE_APP_INSTANCE ?? '0') > 0) {
  logger.warn('presence.multi_instance_unsafe', {
    msg: 'Presence is in-memory single-instance; horizontal scaling needs the Redis seam (#150 FUTURE_EPIC).',
  })
}

export function upsertPresence(businessId: string, entry: PresenceEntry): void {
  let biz = store.get(businessId)
  if (!biz) {
    biz = new Map()
    store.set(businessId, biz)
  }
  biz.set(entry.userId, entry)
}

export function removePresence(businessId: string, userId: string): void {
  const biz = store.get(businessId)
  if (!biz) return
  biz.delete(userId)
  if (biz.size === 0) store.delete(businessId)
}

/** Fresh peers on a given entity, excluding the caller. Lazily sweeps stale entries. */
export function peersOn(
  businessId: string,
  entityType: PresenceEntityType,
  entityId: string,
  excludeUserId: string,
): Peer[] {
  const biz = store.get(businessId)
  if (!biz) return []
  const now = Date.now()
  const peers: Peer[] = []
  for (const [uid, e] of biz) {
    if (now - e.lastSeen > TTL_MS) {
      biz.delete(uid)
      continue
    }
    if (uid === excludeUserId) continue
    if (e.entityType === entityType && e.entityId === entityId) {
      peers.push({ userId: e.userId, userName: e.userName, mode: e.mode })
    }
  }
  if (biz.size === 0) store.delete(businessId)
  return peers
}

/** Periodic full sweep so memory stays bounded even for entities nobody polls. */
function sweepAll(): void {
  const now = Date.now()
  for (const [bizId, biz] of store) {
    for (const [uid, e] of biz) {
      if (now - e.lastSeen > TTL_MS) biz.delete(uid)
    }
    if (biz.size === 0) store.delete(bizId)
  }
}

const sweepTimer = setInterval(sweepAll, SWEEP_MS)
sweepTimer.unref?.() // never keep the process alive for the sweep

/** Test-only: reset the store between cases. */
export function __resetPresence(): void {
  store.clear()
}
