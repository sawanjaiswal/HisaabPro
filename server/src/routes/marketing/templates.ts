/**
 * Marketing Templates Router (PR2)
 * Mounted at /api/marketing/templates via marketing.ts
 */

import { Router } from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { auth } from '../../middleware/auth.js'
import { idempotencyCheck } from '../../middleware/idempotency.js'
import { sendSuccess, sendError, sendPaginated } from '../../lib/response.js'
import {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from '../../services/marketing/marketing-template.service.js'
import {
  createMarketingTemplateSchema,
  updateMarketingTemplateSchema,
} from '../../services/marketing/marketing-template.validators.js'
import { createRateLimiter } from '../../middleware/rate-limit/factory.js'
import { prisma } from '../../lib/prisma.js'

const router = Router()
router.use(auth)

const templateMutationLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 30,
  message: 'Too many template requests',
  keyFn: (req) => `rl:tmpl:${req.user?.businessId ?? req.ip}`,
  eventName: 'marketing.templates.rate_limited',
})

// GET /api/marketing/templates
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { channel, cursor, limit } = req.query
    const result = await listTemplates(
      req.user!.businessId,
      channel as string | undefined,
      cursor as string | undefined,
      limit ? Math.min(Number(limit), 100) : 20,
    )
    sendPaginated(res, result.data, result.nextCursor)
  }),
)

// GET /api/marketing/templates/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const tmpl = await getTemplate(String(req.params['id']), req.user!.businessId)
    if (!tmpl) return sendError(res, 'Template not found', 'NOT_FOUND', 404)
    sendSuccess(res, tmpl)
  }),
)

// POST /api/marketing/templates
router.post(
  '/',
  templateMutationLimiter,
  idempotencyCheck(),
  asyncHandler(async (req, res) => {
    const parsed = createMarketingTemplateSchema.safeParse(req.body)
    if (!parsed.success) {
      return sendError(res, parsed.error.issues.map((i) => i.message).join(', '), 'VALIDATION_ERROR', 400)
    }
    const tmpl = await createTemplate(req.user!.businessId, req.user!.userId, parsed.data)
    sendSuccess(res, tmpl, 201)
  }),
)

// PUT /api/marketing/templates/:id
router.put(
  '/:id',
  templateMutationLimiter,
  asyncHandler(async (req, res) => {
    const parsed = updateMarketingTemplateSchema.safeParse(req.body)
    if (!parsed.success) {
      return sendError(res, parsed.error.issues.map((i) => i.message).join(', '), 'VALIDATION_ERROR', 400)
    }
    const tmpl = await updateTemplate(String(req.params['id']), req.user!.businessId, parsed.data)
    if (!tmpl) return sendError(res, 'Template not found', 'NOT_FOUND', 404)
    sendSuccess(res, tmpl)
  }),
)

// DELETE /api/marketing/templates/:id — OWNER/ADMIN only
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    // Role check: OWNER or ADMIN
    const bu = await prisma.businessUser.findUnique({
      where: { userId_businessId: { userId: req.user!.userId, businessId: req.user!.businessId } },
      select: { role: true },
    })
    if (!bu || !['owner', 'admin'].includes(bu.role)) {
      return sendError(res, 'Only owners or admins can delete templates', 'FORBIDDEN', 403)
    }
    const ok = await deleteTemplate(String(req.params['id']), req.user!.businessId, res)
    if (ok) sendSuccess(res, { deleted: true })
  }),
)

export default router
