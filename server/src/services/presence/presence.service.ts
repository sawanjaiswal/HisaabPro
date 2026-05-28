// #150 Presence service — orchestrates ownership validation, the in-memory
// store, and SSE fan-out. Oracle-free: a foreign or unknown entityId yields the
// SAME empty-peers response as a real entity with no peers, and never touches
// the store or emits an event (security-critique M1).
import { prisma } from '../../lib/prisma.js'
import { broadcast } from '../sse.service.js'
import { upsertPresence, removePresence, peersOn } from './presence.store.js'
import type { PresenceEntityType, PresenceMode, Peer } from './presence.types.js'

const OWNER_MODEL: Record<PresenceEntityType, 'party' | 'product' | 'document' | 'payment'> = {
  party: 'party',
  product: 'product',
  document: 'document',
  payment: 'payment',
}

// Small name cache so a 20s heartbeat doesn't hit the User table every time.
const NAME_TTL_MS = 5 * 60_000
const nameCache = new Map<string, { name: string; ts: number }>()

async function resolveUserName(userId: string): Promise<string> {
  const hit = nameCache.get(userId)
  if (hit && Date.now() - hit.ts < NAME_TTL_MS) return hit.name
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, phone: true } })
  const name = user?.name?.trim() || user?.phone || 'Teammate'
  nameCache.set(userId, { name, ts: Date.now() })
  return name
}

/** True only if the entity exists AND belongs to the caller's business. */
async function ownsEntity(businessId: string, entityType: PresenceEntityType, entityId: string): Promise<boolean> {
  const model = OWNER_MODEL[entityType]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = await (prisma as any)[model].findFirst({ where: { id: entityId, businessId }, select: { id: true } })
  return Boolean(row)
}

export async function heartbeat(
  businessId: string,
  userId: string,
  entityType: PresenceEntityType,
  entityId: string,
  mode: PresenceMode,
): Promise<Peer[]> {
  // Oracle-free gate: bail with an identical empty response before any store
  // touch or SSE emit when the entity isn't ours.
  if (!(await ownsEntity(businessId, entityType, entityId))) return []

  const userName = await resolveUserName(userId)
  upsertPresence(businessId, { userId, userName, entityType, entityId, mode, lastSeen: Date.now() })

  // businessId comes from the token (sec M2) — never from the request body.
  broadcast(businessId, { type: 'PRESENCE_UPDATE', entityType, entityId, userId, timestamp: Date.now() }, userId)

  return peersOn(businessId, entityType, entityId, userId)
}

export async function leave(businessId: string, userId: string): Promise<void> {
  removePresence(businessId, userId)
  broadcast(businessId, { type: 'PRESENCE_LEAVE', userId, timestamp: Date.now() }, userId)
}

/** Read-only peer list. No DB hit, no oracle — the store is businessId-scoped. */
export function getPeers(
  businessId: string,
  entityType: PresenceEntityType,
  entityId: string,
  userId: string,
): Peer[] {
  return peersOn(businessId, entityType, entityId, userId)
}
