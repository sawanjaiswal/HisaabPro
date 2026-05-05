/**
 * Payment Links routes
 *
 * POST   /api/payments/payment-links        — create link (Idempotency-Key required)
 * GET    /api/payments/payment-links        — list links (?invoiceId=)
 * DELETE /api/payments/payment-links/:id   — cancel link
 */

import { Router } from 'express'
import { z } from 'zod'
import { auth } from '../../middleware/auth.js'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { validate } from '../../middleware/validate.js'
import { requirePermission } from '../../middleware/permission.js'
import { createRateLimiter } from '../../middleware/rate-limit.js'
import { sendSuccess, sendError } from '../../lib/response.js'
import { createPaymentLink, getPaymentLinks } from '../../services/collections/payment-link-create.js'
import { cancelPaymentLink } from '../../services/collections/payment-link-cancel.js'

const router = Router()

const createSchema = z.object({
  invoiceId: z.string().min(1),
  amountPaise: z.number().int().positive().optional(),
  expiryDays: z.number().int().min(1).max(30).optional(),
})

const listSchema = z.object({
  invoiceId: z.string().min(1),
})

// Rate limit: 10 payment-link creations per user per minute
const paymentLinkLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 10,
  message: 'Too many payment link requests — try again in a minute',
  keyFn: (req) => `pl:${req.user?.userId ?? req.ip}`,
  eventName: 'PAYMENT_LINK_RATE_LIMITED',
})

// POST — create payment link
router.post(
  '/',
  auth,
  paymentLinkLimiter,
  requirePermission('collections.collect'),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const idempotencyKey = req.headers['x-idempotency-key'] as string | undefined
    if (!idempotencyKey) {
      sendError(res, 'X-Idempotency-Key header is required', 'MISSING_IDEMPOTENCY_KEY', 400)
      return
    }

    const { invoiceId, amountPaise, expiryDays } = req.body as z.infer<typeof createSchema>
    const { businessId, userId } = req.user!

    const result = await createPaymentLink(businessId, invoiceId, userId, {
      amountPaise,
      expiryDays,
      idempotencyKey,
    })

    const status = result.idempotent ? 200 : 201
    sendSuccess(res, result.link, status)
  }),
)

// GET — list links for an invoice
router.get(
  '/',
  auth,
  requirePermission('collections.view'),
  asyncHandler(async (req, res) => {
    const parsed = listSchema.safeParse(req.query)
    if (!parsed.success) {
      sendError(res, 'invoiceId query param is required', 'VALIDATION_ERROR', 400)
      return
    }

    const { businessId } = req.user!
    const links = await getPaymentLinks(businessId, parsed.data.invoiceId)
    sendSuccess(res, links)
  }),
)

// DELETE — cancel link
router.delete(
  '/:id',
  auth,
  requirePermission('collections.collect'),
  asyncHandler(async (req, res) => {
    const { businessId, userId } = req.user!
    const linkId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const link = await cancelPaymentLink(businessId, linkId, userId)
    sendSuccess(res, link)
  }),
)

export default router
