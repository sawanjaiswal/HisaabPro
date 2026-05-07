/**
 * SSE Notifications Registry (PR9)
 *
 * Security controls:
 *   P0-7: Origin/Referer guard — only configured allowedOrigins accepted.
 *   P0-7: Per-IP concurrent stream cap (max 5).
 *   P2-5: SSE payload restricted to { type, unreadCount } — no notification content.
 *
 * Heartbeat: `: heartbeat\n\n` every 25 s per connection.
 * Module exports a singleton — import { sseRegistry } to access.
 */

import type { Response } from 'express'
import logger from './logger.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SseConnection {
  connId: string
  res: Response
  heartbeat: NodeJS.Timeout
  ip: string
}

/** Restricted payload — P2-5: no notification content */
export interface SseNotificationPayload {
  type: string
  unreadCount: number
}

// ---------------------------------------------------------------------------
// Allowed origins (mirrored from app.ts allowedOrigins)
// ---------------------------------------------------------------------------

const ALLOWED_ORIGINS: string[] = [
  ...(process.env.CORS_ORIGIN?.split(',') ?? [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
  ]),
  'https://hisaabpro.in',
  'https://app.hisaabpro.in',
  'https://admin.hisaabpro.in',
  'https://localhost',
  'capacitor://localhost',
]

export const MAX_SSE_STREAMS_PER_IP = 5
const HEARTBEAT_MS = 25_000

// ---------------------------------------------------------------------------
// SseRegistry
// ---------------------------------------------------------------------------

export class SseRegistry {
  /** userId → Set of active connections */
  private readonly _userConns = new Map<string, Map<string, SseConnection>>()
  /** ip → count of active connections */
  private readonly _ipCounts = new Map<string, number>()

  /**
   * Validate origin/referer against allowedOrigins.
   * Returns true if the request is allowed, false otherwise.
   */
  isOriginAllowed(origin: string | undefined, referer: string | undefined): boolean {
    const candidate = origin ?? (referer ? new URL(referer).origin : undefined)
    if (!candidate) return false
    return ALLOWED_ORIGINS.some((allowed) =>
      candidate.startsWith(allowed) || allowed.startsWith(candidate),
    )
  }

  /** Returns current IP stream count */
  ipStreamCount(ip: string): number {
    return this._ipCounts.get(ip) ?? 0
  }

  /**
   * Register an SSE connection for userId.
   * Caller is responsible for the Origin/IP cap checks before calling register().
   */
  register(userId: string, res: Response, ip: string): string {
    const connId = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    // SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    res.flushHeaders()

    // Heartbeat
    const heartbeat = setInterval(() => {
      if (!res.writableEnded) {
        res.write(': heartbeat\n\n')
      } else {
        this.unregister(userId, connId)
      }
    }, HEARTBEAT_MS)

    const conn: SseConnection = { connId, res, heartbeat, ip }

    if (!this._userConns.has(userId)) {
      this._userConns.set(userId, new Map())
    }
    this._userConns.get(userId)!.set(connId, conn)

    // Track IP counts
    this._ipCounts.set(ip, (this._ipCounts.get(ip) ?? 0) + 1)

    // Clean up on client disconnect
    res.on('close', () => {
      this.unregister(userId, connId)
    })

    logger.debug('sse.registered', { userId, connId, ip })
    return connId
  }

  /** Remove a connection and clean up its heartbeat. */
  unregister(userId: string, connId: string): void {
    const userMap = this._userConns.get(userId)
    if (!userMap) return

    const conn = userMap.get(connId)
    if (!conn) return

    clearInterval(conn.heartbeat)
    userMap.delete(connId)

    if (userMap.size === 0) {
      this._userConns.delete(userId)
    }

    // Decrement IP count
    const ipCount = (this._ipCounts.get(conn.ip) ?? 1) - 1
    if (ipCount <= 0) {
      this._ipCounts.delete(conn.ip)
    } else {
      this._ipCounts.set(conn.ip, ipCount)
    }

    logger.debug('sse.unregistered', { userId, connId })
  }

  /**
   * Broadcast a restricted payload to all connections for userId.
   * P2-5: Only { type, unreadCount } is sent — no notification body/title.
   */
  broadcast(userId: string, payload: SseNotificationPayload): void {
    const userMap = this._userConns.get(userId)
    if (!userMap || userMap.size === 0) return

    // P2-5: Restrict payload shape — strip any extra fields
    const restricted = JSON.stringify({ type: payload.type, unreadCount: payload.unreadCount })
    const chunk = `data: ${restricted}\n\n`

    for (const [connId, conn] of userMap) {
      if (conn.res.writableEnded) {
        this.unregister(userId, connId)
        continue
      }
      try {
        conn.res.write(chunk)
      } catch (err) {
        logger.warn('sse.write_failed', { userId, connId, err })
        this.unregister(userId, connId)
      }
    }
  }

  /** Alias for in-app provider's SseRegistry interface shape. */
  emit(userId: string, _event: string, _data: unknown): void {
    // In-app provider passes { notificationId, businessId } but we only forward
    // { type, unreadCount } — look up live count and broadcast (P2-5).
    void this._broadcastNewNotification(userId)
  }

  private async _broadcastNewNotification(userId: string): Promise<void> {
    try {
      const { prisma } = await import('./prisma.js')
      const unreadCount = await prisma.notification.count({
        where: { userId, isRead: false },
      })
      this.broadcast(userId, { type: 'notification:new', unreadCount })
    } catch (err) {
      logger.warn('sse.broadcast_count_failed', { userId, err })
    }
  }
}

// ---------------------------------------------------------------------------
// Module singleton
// ---------------------------------------------------------------------------

export const sseRegistry = new SseRegistry()
