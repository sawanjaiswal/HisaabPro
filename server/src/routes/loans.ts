/**
 * Loan Account Routes
 * All routes require auth. businessId resolved from user's active BusinessUser record.
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission.js'
import { sendSuccess } from '../lib/response.js'
import {
  createLoanSchema,
  listLoansSchema,
  recordLoanTransactionSchema,
} from '../schemas/loan.schemas.js'
import * as loanService from '../services/loan.service.js'

const router = Router()

router.use(auth)

/** POST /api/loans — Create a new loan account */
router.post(
  '/',
  requirePermission('accounting.create'),
  validate(createLoanSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const loan = await loanService.createLoanAccount(businessId, req.user!.userId, req.body)
    sendSuccess(res, loan, 201)
  }),
)

/** GET /api/loans — List loan accounts (filterable by type, status, paginated) */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const query = listLoansSchema.parse(req.query)
    const result = await loanService.listLoanAccounts(businessId, query)
    sendSuccess(res, result)
  }),
)

/** GET /api/loans/:id — Get a single loan account with all transactions */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const loan = await loanService.getLoanAccount(businessId, String(req.params.id))
    sendSuccess(res, loan)
  }),
)

/** GET /api/loans/:id/statement — Get loan statement with running balance */
router.get(
  '/:id/statement',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const statement = await loanService.getLoanStatement(businessId, String(req.params.id))
    sendSuccess(res, statement)
  }),
)

/** POST /api/loans/:id/transactions — Record EMI, interest, prepayment, disbursement, or closure */
router.post(
  '/:id/transactions',
  requirePermission('accounting.create'),
  validate(recordLoanTransactionSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const transaction = await loanService.recordLoanTransaction(
      businessId,
      String(req.params.id),
      req.body,
    )
    sendSuccess(res, transaction, 201)
  }),
)

/** POST /api/loans/:id/close — Mark loan as CLOSED with outstandingAmount = 0 */
router.post(
  '/:id/close',
  requirePermission('accounting.edit'),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const loan = await loanService.closeLoan(businessId, String(req.params.id))
    sendSuccess(res, loan)
  }),
)

export default router
