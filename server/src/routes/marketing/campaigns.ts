/**
 * Marketing Campaigns Router (PR4)
 * Mounted at /api/marketing/campaigns via marketing.ts
 */

import { Router } from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { auth } from '../../middleware/auth.js'
import { idempotencyCheck } from '../../middleware/idempotency.js'
import { sendSuccess, sendError, sendPaginated } from '../../lib/response.js'
import {
  listCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  getCampaignRecipients,
  createCampaignSchema,
  updateCampaignSchema,
} from '../../services/marketing/campaign.service.js'
import { launchCampaign, cancelCampaign, CostCapExceededError } from '../../services/marketing/campaign-dispatch.service.js'
import { createRateLimiter } from '../../middleware/rate-limit/factory.js'
import { prisma } from '../../lib/prisma.js'

const router = Router()
router.use(auth)

const createLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 30,
  message: 'Too many campaign create requests',
  keyFn: (req) => `rl:camp:create:${req.user?.businessId ?? req.ip}`,
})

const launchLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 5,
  message: 'Too many launch requests',
  keyFn: (req) => `rl:camp:launch:${req.user?.businessId ?? req.ip}`,
})

const launchHourlyLimiter = createRateLimiter({
  windowMs: 3_600_000,
  max: 30,
  message: 'Hourly launch limit reached',
  keyFn: (req) => `rl:camp:launch:h:${req.user?.businessId ?? req.ip}`,
})

// Resolve role helper
async function resolveRole(userId: string, businessId: string): Promise<string> {
  const bu = await prisma.businessUser.findUnique({
    where: { userId_businessId: { userId, businessId } },
    select: { role: true },
  })
  return bu?.role ?? 'staff'
}

// GET /api/marketing/campaigns
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status, cursor, limit } = req.query
    const result = await listCampaigns(
      req.user!.businessId,
      status as string | undefined,
      cursor as string | undefined,
      limit ? Math.min(Number(limit), 100) : 20,
    )
    sendPaginated(res, result.data, result.nextCursor)
  }),
)

// GET /api/marketing/campaigns/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const campaign = await getCampaign(String(req.params['id']), req.user!.businessId)
    if (!campaign) return sendError(res, 'Campaign not found', 'NOT_FOUND', 404)
    sendSuccess(res, campaign)
  }),
)

// GET /api/marketing/campaigns/:id/recipients
router.get(
  '/:id/recipients',
  asyncHandler(async (req, res) => {
    const { status, cursor, limit } = req.query
    const result = await getCampaignRecipients(
      String(req.params['id']),
      req.user!.businessId,
      status as string | undefined,
      cursor as string | undefined,
      limit ? Math.min(Number(limit), 100) : 50,
    )
    if (!result) return sendError(res, 'Campaign not found', 'NOT_FOUND', 404)
    sendPaginated(res, result.data, result.nextCursor)
  }),
)

// POST /api/marketing/campaigns
router.post(
  '/',
  createLimiter,
  idempotencyCheck(),
  asyncHandler(async (req, res) => {
    const parsed = createCampaignSchema.safeParse(req.body)
    if (!parsed.success) {
      return sendError(res, parsed.error.issues.map((i) => i.message).join(', '), 'VALIDATION_ERROR', 400)
    }
    const campaign = await createCampaign(req.user!.businessId, req.user!.userId, parsed.data)
    sendSuccess(res, campaign, 201)
  }),
)

// PUT /api/marketing/campaigns/:id
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const parsed = updateCampaignSchema.safeParse(req.body)
    if (!parsed.success) {
      return sendError(res, parsed.error.issues.map((i) => i.message).join(', '), 'VALIDATION_ERROR', 400)
    }
    const campaign = await updateCampaign(String(req.params['id']), req.user!.businessId, parsed.data)
    if (!campaign) return sendError(res, 'Campaign not found', 'NOT_FOUND', 404)
    sendSuccess(res, campaign)
  }),
)

// POST /api/marketing/campaigns/:id/launch — OWNER/ADMIN only
router.post(
  '/:id/launch',
  launchLimiter,
  launchHourlyLimiter,
  asyncHandler(async (req, res) => {
    const role = await resolveRole(req.user!.userId, req.user!.businessId)
    if (!['owner', 'admin'].includes(role)) {
      return sendError(res, 'Only owners or admins can launch campaigns', 'FORBIDDEN', 403)
    }

    try {
      const result = await launchCampaign(
        String(req.params['id']),
        req.user!.businessId,
        req.user!.userId,
        role,
      )
      sendSuccess(res, { campaignId: req.params.id, ...result })
    } catch (err) {
      const e = err as { statusCode?: number; code?: string; estimatePaise?: number; remainingPaise?: number; message?: string }
      if (err instanceof CostCapExceededError) {
        return res.status(402).json({
          success: false,
          error: { code: 'COST_CAP_EXCEEDED', message: e.message, estimatePaise: e.estimatePaise, remainingPaise: e.remainingPaise },
        })
      }
      if (e.statusCode && e.code) {
        return res.status(e.statusCode).json({ success: false, error: { code: e.code, message: e.message } })
      }
      throw err
    }
  }),
)

// POST /api/marketing/campaigns/:id/cancel — OWNER/ADMIN only
router.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const role = await resolveRole(req.user!.userId, req.user!.businessId)
    if (!['owner', 'admin'].includes(role)) {
      return sendError(res, 'Only owners or admins can cancel campaigns', 'FORBIDDEN', 403)
    }

    try {
      const result = await cancelCampaign(
        String(req.params['id']),
        req.user!.businessId,
        req.user!.userId,
        role,
      )
      sendSuccess(res, result)
    } catch (err) {
      const e = err as { statusCode?: number; code?: string; message?: string }
      if (e.statusCode && e.code) {
        return res.status(e.statusCode).json({ success: false, error: { code: e.code, message: e.message } })
      }
      throw err
    }
  }),
)

export default router
