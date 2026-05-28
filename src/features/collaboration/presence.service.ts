// #150 Presence API calls. All go through api() per OFFLINE_RULES; presence is
// transient so these are network-only and never queued offline.
import { api } from '@/lib/api'
import type { PresenceEntityType, PresenceMode, PeersResponse } from './collaboration.types'

export async function sendHeartbeat(
  entityType: PresenceEntityType,
  entityId: string,
  mode: PresenceMode,
): Promise<PeersResponse> {
  return api<PeersResponse>('/presence/heartbeat', {
    method: 'POST',
    body: JSON.stringify({ entityType, entityId, mode }),
    offlineQueue: false,
  })
}

export async function leavePresence(): Promise<void> {
  await api('/presence', { method: 'DELETE', offlineQueue: false })
}

export async function fetchPeers(
  entityType: PresenceEntityType,
  entityId: string,
): Promise<PeersResponse> {
  return api<PeersResponse>(`/presence/${entityType}/${entityId}`)
}
