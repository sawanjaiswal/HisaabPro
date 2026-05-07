/** Notifications Router — user-facing endpoints (PR9). All routes requireAuth.
 * Cross-tenant: every query filters businessId+userId. P0-7: Origin guard + IP cap. P2-5: SSE payload restricted. */
import { Router } from 'express'
import { z } from 'zod'
import { auth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { sendSuccess, sendError } from '../lib/response.js'
import { prisma } from '../lib/prisma.js'
import { sseRegistry, MAX_SSE_STREAMS_PER_IP } from '../lib/sse-notifications.js'
import { setSseRegistry } from '../services/notifications/providers/in-app.provider.js'
import {
  getPreferences,
  updatePreferences,
  updateQuietHours,
} from '../services/notifications/notification-preference.service.js'
import type { NotificationChannel } from '@prisma/client'
import logger from '../lib/logger.js'

// Wire the SSE registry into the in-app provider once at module load.
setSseRegistry(sseRegistry)

const router = Router()
router.use(auth)

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const HH_MM = /^\d{2}:\d{2}$/

const listQuerySchema = z.object({
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

const preferencePatchSchema = z
  .array(
    z.object({
      eventKey: z.string().min(1).max(60),
      channel: z.enum(['PUSH', 'EMAIL', 'SMS', 'IN_APP', 'WHATSAPP'] as [NotificationChannel, ...NotificationChannel[]]),
      enabled: z.boolean(),
    }),
  )
  .min(1)

const prefsPutSchema = z.object({ prefs: preferencePatchSchema }).strict()

const quietHoursPutSchema = z
  .object({
    quietHoursStart: z.string().regex(HH_MM, 'Must be HH:MM'),
    quietHoursEnd: z.string().regex(HH_MM, 'Must be HH:MM'),
  })
  .strict()

// ---------------------------------------------------------------------------
// GET /api/notifications — cursor-paginated inbox + unreadCount
// ---------------------------------------------------------------------------

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { businessId, userId } = req.user!
    const { cursor, limit } = listQuerySchema.parse(req.query)

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: {
          businessId,
          userId,
          ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        select: {
          id: true,
          eventKey: true,
          titleEn: true,
          titleHi: true,
          bodyEn: true,
          bodyHi: true,
          isRead: true,
          readAt: true,
          deepLinkUrl: true,
          entityType: true,
          entityId: true,
          createdAt: true,
        },
      }),
      prisma.notification.count({ where: { businessId, userId, isRead: false } }),
    ])

    const hasMore = notifications.length > limit
    const data = hasMore ? notifications.slice(0, limit) : notifications
    const nextCursor = hasMore ? data[data.length - 1]?.createdAt.toISOString() ?? null : null

    sendSuccess(res, { data, nextCursor, unreadCount })
  }),
)

// ---------------------------------------------------------------------------
// GET /api/notifications/unread-count
// ---------------------------------------------------------------------------

router.get(
  '/unread-count',
  asyncHandler(async (req, res) => {
    const { businessId, userId } = req.user!
    const unreadCount = await prisma.notification.count({
      where: { businessId, userId, isRead: false },
    })
    sendSuccess(res, { unreadCount })
  }),
)

// ---------------------------------------------------------------------------
// GET /api/notifications/preferences
// ---------------------------------------------------------------------------

router.get(
  '/preferences',
  asyncHandler(async (req, res) => {
    const { businessId, userId } = req.user!
    const result = await getPreferences(businessId, userId)
    sendSuccess(res, result)
  }),
)

// ---------------------------------------------------------------------------
// PUT /api/notifications/preferences
// ---------------------------------------------------------------------------

router.put(
  '/preferences',
  asyncHandler(async (req, res) => {
    const parsed = prefsPutSchema.safeParse(req.body)
    if (!parsed.success) {
      return sendError(res, parsed.error.errors[0]?.message ?? 'Invalid body', 'VALIDATION_ERROR', 400)
    }
    const { businessId, userId } = req.user!
    const result = await updatePreferences(businessId, userId, parsed.data.prefs)
    sendSuccess(res, result)
  }),
)

// ---------------------------------------------------------------------------
// GET /api/notifications/settings — quiet hours
// ---------------------------------------------------------------------------

router.get(
  '/settings',
  asyncHandler(async (req, res) => {
    const { businessId, userId } = req.user!
    const { quietHours } = await getPreferences(businessId, userId)
    sendSuccess(res, quietHours)
  }),
)

// ---------------------------------------------------------------------------
// PUT /api/notifications/settings — quiet hours patch
// ---------------------------------------------------------------------------

router.put(
  '/settings',
  asyncHandler(async (req, res) => {
    const parsed = quietHoursPutSchema.safeParse(req.body)
    if (!parsed.success) {
      return sendError(res, parsed.error.errors[0]?.message ?? 'Invalid body', 'VALIDATION_ERROR', 400)
    }
    const { businessId, userId } = req.user!
    await updateQuietHours(businessId, userId, parsed.data.quietHoursStart, parsed.data.quietHoursEnd)
    sendSuccess(res, { quietHoursStart: parsed.data.quietHoursStart, quietHoursEnd: parsed.data.quietHoursEnd })
  }),
)

// ---------------------------------------------------------------------------
// POST /api/notifications/read-all — mark all unread as read
// ---------------------------------------------------------------------------

router.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    const { businessId, userId } = req.user!
    await prisma.notification.updateMany({
      where: { businessId, userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    })
    sendSuccess(res, { ok: true })
  }),
)

// ---------------------------------------------------------------------------
// GET /api/notifications/stream — SSE
// ---------------------------------------------------------------------------

router.get(
  '/stream',
  asyncHandler(async (req, res) => {
    const { userId } = req.user!
    const ip = (req.ip ?? req.socket.remoteAddress ?? 'unknown').replace(/^::ffff:/, '')

    // P0-7: Origin/Referer guard
    const origin = req.headers.origin as string | undefined
    const referer = req.headers.referer as string | undefined
    if (!sseRegistry.isOriginAllowed(origin, referer)) {
      logger.warn('sse.origin_rejected', { ip, origin, referer, userId })
      return sendError(res, 'Origin not allowed', 'FORBIDDEN', 403)
    }

    // P0-7: Per-IP cap (max 5 concurrent streams)
    if (sseRegistry.ipStreamCount(ip) >= MAX_SSE_STREAMS_PER_IP) {
      logger.warn('sse.ip_cap_exceeded', { ip, userId })
      return sendError(res, 'Too many SSE connections from this IP', 'TOO_MANY_CONNECTIONS', 429)
    }

    const connId = sseRegistry.register(userId, res, ip)
    logger.info('sse.connected', { userId, connId, ip })
  }),
)

// ---------------------------------------------------------------------------
// POST /api/notifications/:id/read — mark single notification as read
// ---------------------------------------------------------------------------

router.post(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const { businessId, userId } = req.user!
    const { id } = req.params

    const existing = await prisma.notification.findFirst({
      where: { id: String(id), businessId: String(businessId), userId: String(userId) },
      select: { id: true, isRead: true },
    })

    if (!existing) {
      return sendError(res, 'Notification not found', 'NOT_FOUND', 404)
    }

    if (!existing.isRead) {
      await prisma.notification.update({
        where: { id: existing.id },
        data: { isRead: true, readAt: new Date() },
      })
    }

    sendSuccess(res, { ok: true })
  }),
)

export default router
