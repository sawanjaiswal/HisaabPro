/**
 * SSE (Server-Sent Events) service — real-time sync for multi-user businesses.
 * Per-business event bus. Lightweight, works through proxies, auto-reconnects.
 */

import type { Response } from 'express'
import logger from '../lib/logger.js'

export interface SSEEvent {
  type: string
  entityId?: string
  entityType?: string
  userId?: string
  timestamp: number
}

// Per-business client sets — Map<businessId, Set<Response>>
const clients = new Map<string, Set<Response>>()

/** Subscribe a response stream to business events */
export function subscribe(businessId: string, res: Response): void {
  if (!clients.has(businessId)) {
    clients.set(businessId, new Set())
  }
  clients.get(businessId)!.add(res)

  logger.debug('SSE client connected', {
    businessId,
    activeClients: clients.get(businessId)!.size,
  })
}

/** Remove a client on disconnect */
export function unsubscribe(businessId: string, res: Response): void {
  const set = clients.get(businessId)
  if (set) {
    set.delete(res)
    if (set.size === 0) clients.delete(businessId)
  }
}

/** Broadcast event to all clients of a business (except sender) */
export function broadcast(businessId: string, event: SSEEvent, excludeUserId?: string): void {
  const set = clients.get(businessId)
  if (!set || set.size === 0) return

  const data = JSON.stringify(event)
  const message = `data: ${data}\n\n`

  for (const res of set) {
    try {
      // Skip sender's own connection to avoid double-update
      const clientUserId = (res as Response & { _sseUserId?: string })._sseUserId
      if (excludeUserId && clientUserId === excludeUserId) continue

      res.write(message)
    } catch {
      // Client disconnected — clean up
      set.delete(res)
    }
  }
}

/** Get count of active SSE connections per business (for monitoring) */
export function getClientCount(businessId?: string): number | Record<string, number> {
  if (businessId) return clients.get(businessId)?.size ?? 0

  const counts: Record<string, number> = {}
  for (const [biz, set] of clients) {
    counts[biz] = set.size
  }
  return counts
}

/** Emit a standard mutation event — call from service layer after successful mutations */
export function emitMutationEvent(
  businessId: string,
  entityType: string,
  action: 'CREATED' | 'UPDATED' | 'DELETED',
  entityId: string,
  userId?: string
): void {
  broadcast(
    businessId,
    {
      type: `${entityType}_${action}`,
      entityType,
      entityId,
      userId,
      timestamp: Date.now(),
    },
    userId
  )
}
