/**
 * #147 Bank reconciliation routes. Base path: /api/bank-reconciliation
 * PRO plan + reports permission gated. businessId/userId always from the token.
 */
import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { requirePlan } from '../middleware/subscription-gate.js'
import { requirePermission } from '../middleware/permission.js'
import { sendSuccess } from '../lib/response.js'
import {
  createImportSchema,
  listLinesSchema,
  matchLineSchema,
} from '../schemas/bank-reconciliation.schemas.js'
import * as svc from '../services/bank-reconciliation/bank-reconciliation.service.js'

const router = Router()
router.use(auth)
router.use(requirePlan('PRO'))

/** POST /imports — stage a parsed CSV + auto-suggest matches. */
router.post(
  '/imports',
  requirePermission('reports.view'),
  validate(createImportSchema),
  asyncHandler(async (req, res) => {
    const result = await svc.createImport(req.user!.businessId, req.user!.userId, req.body)
    sendSuccess(res, result, 201)
  }),
)

/** GET /lines — paginated staged lines (optionally filtered). */
router.get(
  '/lines',
  requirePermission('reports.view'),
  asyncHandler(async (req, res) => {
    const filters = listLinesSchema.parse(req.query)
    const result = await svc.listLines(req.user!.businessId, filters)
    sendSuccess(res, result)
  }),
)

/** POST /lines/:lineId/match — manual match to a chosen payment. */
router.post(
  '/lines/:lineId/match',
  requirePermission('reports.view'),
  validate(matchLineSchema),
  asyncHandler(async (req, res) => {
    const result = await svc.matchLineManual(
      req.user!.businessId,
      req.user!.userId,
      String(req.params.lineId),
      req.body.paymentId,
    )
    sendSuccess(res, result, 201)
  }),
)

/** POST /lines/:lineId/confirm — accept the auto suggestion. */
router.post(
  '/lines/:lineId/confirm',
  requirePermission('reports.view'),
  asyncHandler(async (req, res) => {
    const result = await svc.confirmLineAuto(
      req.user!.businessId,
      req.user!.userId,
      String(req.params.lineId),
    )
    sendSuccess(res, result, 201)
  }),
)

/** POST /lines/:lineId/ignore — mark a line ignored. */
router.post(
  '/lines/:lineId/ignore',
  requirePermission('reports.view'),
  asyncHandler(async (req, res) => {
    const result = await svc.ignoreLine(req.user!.businessId, String(req.params.lineId))
    sendSuccess(res, result)
  }),
)

/** DELETE /matches/:lineId — un-reconcile a matched line. */
router.delete(
  '/matches/:lineId',
  requirePermission('reports.view'),
  asyncHandler(async (req, res) => {
    const result = await svc.unreconcileLine(req.user!.businessId, String(req.params.lineId))
    sendSuccess(res, result)
  }),
)

export default router
