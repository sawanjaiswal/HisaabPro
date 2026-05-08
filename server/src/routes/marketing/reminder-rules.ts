/**
 * Reminder Rules Router (PR5)
 * Mounted at /api/marketing/reminder-rules via marketing.ts
 */

import { Router } from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { auth } from '../../middleware/auth.js'
import { idempotencyCheck } from '../../middleware/idempotency.js'
import { sendSuccess, sendError, sendPaginated } from '../../lib/response.js'
import {
  listReminderRules,
  getReminderRule,
  createReminderRule,
  updateReminderRule,
  deleteReminderRule,
  toggleReminderRule,
  createReminderRuleSchema,
  updateReminderRuleSchema,
} from '../../services/marketing/reminder-rule.service.js'
import { prisma } from '../../lib/prisma.js'

const router = Router()
router.use(auth)

async function resolveRole(userId: string, businessId: string): Promise<string> {
  const bu = await prisma.businessUser.findUnique({
    where: { userId_businessId: { userId, businessId } },
    select: { role: true },
  })
  return bu?.role ?? 'staff'
}

// GET /api/marketing/reminder-rules
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { enabled, cursor, limit } = req.query
    const enabledBool = enabled !== undefined ? enabled === 'true' : undefined
    const result = await listReminderRules(
      req.user!.businessId,
      enabledBool,
      cursor as string | undefined,
      limit ? Math.min(Number(limit), 100) : 20,
    )
    sendPaginated(res, result.data, result.nextCursor)
  }),
)

// GET /api/marketing/reminder-rules/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const rule = await getReminderRule(String(req.params['id']), req.user!.businessId)
    if (!rule) return sendError(res, 'Reminder rule not found', 'NOT_FOUND', 404)
    sendSuccess(res, rule)
  }),
)

// POST /api/marketing/reminder-rules
router.post(
  '/',
  idempotencyCheck(),
  asyncHandler(async (req, res) => {
    const parsed = createReminderRuleSchema.safeParse(req.body)
    if (!parsed.success) {
      return sendError(res, parsed.error.issues.map((i) => i.message).join(', '), 'VALIDATION_ERROR', 400)
    }
    try {
      const rule = await createReminderRule(req.user!.businessId, req.user!.userId, parsed.data)
      sendSuccess(res, rule, 201)
    } catch (err) {
      const e = err as { statusCode?: number; code?: string; message?: string }
      if (e.statusCode && e.code) {
        return res.status(e.statusCode).json({ success: false, error: { code: e.code, message: e.message } })
      }
      throw err
    }
  }),
)

// PUT /api/marketing/reminder-rules/:id
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const parsed = updateReminderRuleSchema.safeParse(req.body)
    if (!parsed.success) {
      return sendError(res, parsed.error.issues.map((i) => i.message).join(', '), 'VALIDATION_ERROR', 400)
    }
    const rule = await updateReminderRule(String(req.params['id']), req.user!.businessId, parsed.data)
    if (!rule) return sendError(res, 'Reminder rule not found', 'NOT_FOUND', 404)
    sendSuccess(res, rule)
  }),
)

// DELETE /api/marketing/reminder-rules/:id — OWNER/ADMIN only
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const role = await resolveRole(req.user!.userId, req.user!.businessId)
    if (!['owner', 'admin'].includes(role)) {
      return sendError(res, 'Only owners or admins can delete reminder rules', 'FORBIDDEN', 403)
    }
    const ok = await deleteReminderRule(String(req.params['id']), req.user!.businessId)
    if (!ok) return sendError(res, 'Reminder rule not found', 'NOT_FOUND', 404)
    sendSuccess(res, { deleted: true })
  }),
)

// POST /api/marketing/reminder-rules/:id/toggle — OWNER/ADMIN only
router.post(
  '/:id/toggle',
  asyncHandler(async (req, res) => {
    const role = await resolveRole(req.user!.userId, req.user!.businessId)
    if (!['owner', 'admin'].includes(role)) {
      return sendError(res, 'Only owners or admins can toggle reminder rules', 'FORBIDDEN', 403)
    }
    const rule = await toggleReminderRule(String(req.params['id']), req.user!.businessId)
    if (!rule) return sendError(res, 'Reminder rule not found', 'NOT_FOUND', 404)
    sendSuccess(res, rule)
  }),
)

export default router
