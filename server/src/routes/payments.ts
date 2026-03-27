/**
 * Payment Routes — CRUD, allocations, outstanding, reminders
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { sendSuccess } from '../lib/response.js'
import { idempotencyCheck } from '../middleware/idempotency.js'
import { replayProtection } from '../middleware/replay-protection.js'
import {
  createPaymentSchema,
  updatePaymentSchema,
  listPaymentsSchema,
  updateAllocationsSchema,
  listOutstandingSchema,
  sendReminderSchema,
  sendBulkRemindersSchema,
  listRemindersSchema,
  updateReminderConfigSchema,
} from '../schemas/payment.schemas.js'
import { requirePermission } from '../middleware/permission.js'
import * as paymentService from '../services/payment.service.js'

const router = Router()

router.use(auth)

// ============================================================
// Payments CRUD
// ============================================================

/** GET /api/payments — List payments */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const query = listPaymentsSchema.parse(req.query)
    const result = await paymentService.listPayments(businessId, query)
    sendSuccess(res, result)
  })
)

/** GET /api/payments/:id — Get payment detail */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const payment = await paymentService.getPayment(businessId, String(req.params.id))
    sendSuccess(res, payment)
  })
)

/** POST /api/payments — Record payment */
router.post(
  '/',
  requirePermission('payments.record'),
  replayProtection,
  idempotencyCheck(),
  validate(createPaymentSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const payment = await paymentService.createPayment(businessId, req.user!.userId, req.body)
    sendSuccess(res, payment, 201)
  })
)

/** PUT /api/payments/:id — Update payment */
router.put(
  '/:id',
  requirePermission('payments.edit'),
  replayProtection,
  validate(updatePaymentSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const payment = await paymentService.updatePayment(
      businessId, String(req.params.id), req.user!.userId, req.body
    )
    sendSuccess(res, payment)
  })
)

/** DELETE /api/payments/:id — Soft delete payment */
router.delete(
  '/:id',
  requirePermission('payments.delete'),
  replayProtection,
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const result = await paymentService.deletePayment(
      businessId, String(req.params.id), req.user!.userId
    )
    sendSuccess(res, result)
  })
)

/** POST /api/payments/:id/restore — Restore deleted payment */
router.post(
  '/:id/restore',
  requirePermission('payments.edit'),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const payment = await paymentService.restorePayment(
      businessId, String(req.params.id), req.user!.userId
    )
    sendSuccess(res, payment)
  })
)

// ============================================================
// Allocations
// ============================================================

/** PUT /api/payments/:id/allocations — Update payment allocations */
router.put(
  '/:id/allocations',
  requirePermission('payments.edit'),
  replayProtection,
  validate(updateAllocationsSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const result = await paymentService.updateAllocations(
      businessId, String(req.params.id), req.body
    )
    sendSuccess(res, result)
  })
)

// ============================================================
// Outstanding
// ============================================================

/** GET /api/outstanding — List parties with outstanding balances */
router.get(
  '/outstanding/list',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const query = listOutstandingSchema.parse(req.query)
    const result = await paymentService.listOutstanding(businessId, query)
    sendSuccess(res, result)
  })
)

/** GET /api/outstanding/:partyId — Get party outstanding detail */
router.get(
  '/outstanding/:partyId',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined
    const limit = req.query.limit ? Math.min(Number(req.query.limit), 100) : 20
    const result = await paymentService.getPartyOutstanding(
      businessId,
      String(req.params.partyId),
      cursor,
      limit
    )
    sendSuccess(res, result)
  })
)

// ============================================================
// Reminders
// ============================================================

/** POST /api/payments/reminders/send — Send a reminder */
router.post(
  '/reminders/send',
  requirePermission('payments.view'),
  replayProtection,
  validate(sendReminderSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const result = await paymentService.sendReminder(businessId, req.user!.userId, req.body)
    sendSuccess(res, result, 201)
  })
)

/** POST /api/payments/reminders/send-bulk — Send bulk reminders */
router.post(
  '/reminders/send-bulk',
  requirePermission('payments.view'),
  replayProtection,
  validate(sendBulkRemindersSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const result = await paymentService.sendBulkReminders(businessId, req.user!.userId, req.body)
    sendSuccess(res, result)
  })
)

/** GET /api/payments/reminders — List reminders */
router.get(
  '/reminders/list',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const query = listRemindersSchema.parse(req.query)
    const result = await paymentService.listReminders(businessId, query)
    sendSuccess(res, result)
  })
)

/** GET /api/payments/reminders/config — Get reminder config */
router.get(
  '/reminders/config',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const config = await paymentService.getReminderConfig(businessId)
    sendSuccess(res, config)
  })
)

/** PUT /api/payments/reminders/config — Update reminder config */
router.put(
  '/reminders/config',
  requirePermission('settings.modify'),
  replayProtection,
  validate(updateReminderConfigSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const config = await paymentService.updateReminderConfig(businessId, req.body)
    sendSuccess(res, config)
  })
)

export default router
