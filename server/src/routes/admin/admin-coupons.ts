/**
 * Admin Coupon Management Routes — Feature #96
 *
 * POST   /api/admin/coupons           — create single coupon
 * POST   /api/admin/coupons/bulk      — bulk generate coupons
 * GET    /api/admin/coupons           — list coupons (paginated)
 * GET    /api/admin/coupons/:id       — coupon detail with stats
 * PATCH  /api/admin/coupons/:id       — update coupon
 * DELETE /api/admin/coupons/:id       — deactivate coupon (soft)
 */

import { Router } from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { validate } from '../../middleware/validate.js'
import { requireAdmin, requireSuperAdmin, auditAdminAction } from '../../middleware/admin-auth.js'
import {
  createCouponSchema,
  updateCouponSchema,
  bulkCreateCouponsSchema,
  listCouponsQuerySchema,
} from '../../schemas/coupon.schemas.js'
import {
  createCoupon,
  bulkCreateCoupons,
  listCoupons,
  getCouponDetail,
  updateCoupon,
  deactivateCoupon,
} from '../../services/coupon.service.js'
import { sendSuccess } from '../../lib/response.js'

const router = Router()

// All coupon admin routes require admin + super admin
router.use(requireAdmin)
router.use(requireSuperAdmin)

// ─── POST / — create single coupon ──────────────────────────────────────

router.post(
  '/',
  validate(createCouponSchema),
  asyncHandler(async (req, res) => {
    const coupon = await createCoupon(req.admin!.adminId, req.body)
    await auditAdminAction(req, 'CREATE_COUPON', 'COUPON', coupon.id, { code: coupon.code })
    sendSuccess(res, coupon, 201)
  })
)

// ─── POST /bulk — bulk generate coupons ──────────────────────────────────

router.post(
  '/bulk',
  validate(bulkCreateCouponsSchema),
  asyncHandler(async (req, res) => {
    const result = await bulkCreateCoupons(req.admin!.adminId, req.body)
    await auditAdminAction(req, 'BULK_CREATE_COUPONS', 'COUPON', undefined, {
      prefix: req.body.prefix,
      count: result.created,
    })
    sendSuccess(res, result, 201)
  })
)

// ─── GET / — list coupons ────────────────────────────────────────────────

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = listCouponsQuerySchema.parse({
      cursor: req.query['cursor'],
      limit: req.query['limit'],
      status: req.query['status'],
      search: req.query['search'],
    })
    const result = await listCoupons(query)
    sendSuccess(res, result)
  })
)

// ─── GET /:id — coupon detail with stats ─────────────────────────────────

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const couponId = req.params['id'] as string
    const detail = await getCouponDetail(couponId)
    await auditAdminAction(req, 'VIEW_COUPON', 'COUPON', couponId)
    sendSuccess(res, detail)
  })
)

// ─── PATCH /:id — update coupon ──────────────────────────────────────────

router.patch(
  '/:id',
  validate(updateCouponSchema),
  asyncHandler(async (req, res) => {
    const couponId = req.params['id'] as string
    const coupon = await updateCoupon(couponId, req.body)
    await auditAdminAction(req, 'UPDATE_COUPON', 'COUPON', couponId, {
      fields: Object.keys(req.body),
    })
    sendSuccess(res, coupon)
  })
)

// ─── DELETE /:id — deactivate coupon (soft) ──────────────────────────────

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const couponId = req.params['id'] as string
    const result = await deactivateCoupon(couponId)
    await auditAdminAction(req, 'DEACTIVATE_COUPON', 'COUPON', couponId)
    sendSuccess(res, result)
  })
)

export default router
