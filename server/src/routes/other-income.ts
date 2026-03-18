/**
 * Other Income Routes
 * All routes require auth. businessId resolved from user's active BusinessUser record.
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { sendSuccess } from '../lib/response.js'
import {
  createOtherIncomeSchema,
  updateOtherIncomeSchema,
  listOtherIncomeSchema,
} from '../schemas/other-income.schemas.js'
import * as otherIncomeService from '../services/other-income.service.js'

const router = Router()

router.use(auth)

/** POST /api/other-income — Record a new other income entry */
router.post(
  '/',
  validate(createOtherIncomeSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const income = await otherIncomeService.createOtherIncome(
      businessId,
      req.user!.userId,
      req.body,
    )
    sendSuccess(res, income, 201)
  }),
)

/** GET /api/other-income — List other income (filterable by category, date range) */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const query = listOtherIncomeSchema.parse(req.query)
    const result = await otherIncomeService.listOtherIncome(businessId, query)
    sendSuccess(res, result)
  }),
)

/** GET /api/other-income/summary — Aggregated summary grouped by category */
router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const from = req.query.from ? new Date(String(req.query.from)) : undefined
    const to = req.query.to ? new Date(String(req.query.to)) : undefined
    const summary = await otherIncomeService.getOtherIncomeSummary(businessId, from, to)
    sendSuccess(res, summary)
  }),
)

/** GET /api/other-income/:id — Get a single other income record */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const income = await otherIncomeService.getOtherIncome(businessId, String(req.params.id))
    sendSuccess(res, income)
  }),
)

/** PUT /api/other-income/:id — Update an other income record */
router.put(
  '/:id',
  validate(updateOtherIncomeSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const income = await otherIncomeService.updateOtherIncome(
      businessId,
      String(req.params.id),
      req.body,
    )
    sendSuccess(res, income)
  }),
)

/** DELETE /api/other-income/:id — Soft delete an other income record */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const result = await otherIncomeService.deleteOtherIncome(businessId, String(req.params.id))
    sendSuccess(res, result)
  }),
)

export default router
