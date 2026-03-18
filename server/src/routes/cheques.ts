/**
 * Cheque Routes
 * All routes require auth. businessId resolved from user's active BusinessUser record.
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { sendSuccess } from '../lib/response.js'
import {
  createChequeSchema,
  updateChequeStatusSchema,
  listChequesSchema,
} from '../schemas/cheque.schemas.js'
import * as chequeService from '../services/cheque.service.js'

const router = Router()

router.use(auth)

/** POST /api/cheques — Record a new cheque (issued or received) */
router.post(
  '/',
  validate(createChequeSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const cheque = await chequeService.createCheque(businessId, req.user!.userId, req.body)
    sendSuccess(res, cheque, 201)
  }),
)

/** GET /api/cheques — List cheques (filterable by type, status, bankAccount, date range) */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const query = listChequesSchema.parse(req.query)
    const result = await chequeService.listCheques(businessId, query)
    sendSuccess(res, result)
  }),
)

/** GET /api/cheques/summary — Cheque register summary (counts by status per type) */
router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const summary = await chequeService.getChequeRegisterSummary(businessId)
    sendSuccess(res, summary)
  }),
)

/** GET /api/cheques/:id — Get a single cheque */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const cheque = await chequeService.getCheque(businessId, String(req.params.id))
    sendSuccess(res, cheque)
  }),
)

/** PUT /api/cheques/:id/status — Update cheque status (clear, bounce, cancel, return) */
router.put(
  '/:id/status',
  validate(updateChequeStatusSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const cheque = await chequeService.updateChequeStatus(
      businessId,
      String(req.params.id),
      req.body,
    )
    sendSuccess(res, cheque)
  }),
)

/** DELETE /api/cheques/:id — Soft delete a PENDING cheque */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const result = await chequeService.deleteCheque(businessId, String(req.params.id))
    sendSuccess(res, result)
  }),
)

export default router
