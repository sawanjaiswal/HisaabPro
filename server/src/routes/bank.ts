/**
 * Bank Account Routes
 * All routes require auth. businessId resolved from user's active BusinessUser record.
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { sendSuccess } from '../lib/response.js'
import {
  createBankAccountSchema,
  updateBankAccountSchema,
  listBankAccountsSchema,
} from '../schemas/bank.schemas.js'
import * as bankService from '../services/bank.service.js'

const router = Router()

router.use(auth)

/** POST /api/bank — Create a new bank account */
router.post(
  '/',
  validate(createBankAccountSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const account = await bankService.createBankAccount(businessId, req.body)
    sendSuccess(res, account, 201)
  }),
)

/** GET /api/bank — List bank accounts (filterable by isActive, paginated) */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const query = listBankAccountsSchema.parse(req.query)
    const result = await bankService.listBankAccounts(businessId, query)
    sendSuccess(res, result)
  }),
)

/** GET /api/bank/:id — Get a single bank account with cheque count */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const account = await bankService.getBankAccount(businessId, String(req.params.id))
    sendSuccess(res, account)
  }),
)

/** PUT /api/bank/:id — Update a bank account */
router.put(
  '/:id',
  validate(updateBankAccountSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const account = await bankService.updateBankAccount(
      businessId,
      String(req.params.id),
      req.body,
    )
    sendSuccess(res, account)
  }),
)

/** DELETE /api/bank/:id — Soft delete (blocks if cheques linked) */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const result = await bankService.deleteBankAccount(businessId, String(req.params.id))
    sendSuccess(res, result)
  }),
)

export default router
