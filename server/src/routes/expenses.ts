/**
 * Expense Routes
 * All routes require auth. businessId resolved from user's active BusinessUser record.
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { sendSuccess } from '../lib/response.js'
import {
  createExpenseCategorySchema,
  createExpenseSchema,
  updateExpenseSchema,
  listExpensesSchema,
} from '../schemas/expense.schemas.js'
import * as expenseService from '../services/expense.service.js'

const router = Router()

router.use(auth)

// ─── Categories ───────────────────────────────────────────────────────────────

/** POST /api/expenses/categories — Create a custom expense category */
router.post(
  '/categories',
  validate(createExpenseCategorySchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const category = await expenseService.createExpenseCategory(businessId, req.body)
    sendSuccess(res, category, 201)
  }),
)

/** GET /api/expenses/categories — List all active expense categories */
router.get(
  '/categories',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const categories = await expenseService.listExpenseCategories(businessId)
    sendSuccess(res, categories)
  }),
)

/** POST /api/expenses/categories/seed — Seed system default categories (idempotent) */
router.post(
  '/categories/seed',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const categories = await expenseService.seedDefaultCategories(businessId)
    sendSuccess(res, categories)
  }),
)

// ─── Expenses ─────────────────────────────────────────────────────────────────

/** POST /api/expenses — Create a new expense */
router.post(
  '/',
  validate(createExpenseSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const expense = await expenseService.createExpense(businessId, req.user!.userId, req.body)
    sendSuccess(res, expense, 201)
  }),
)

/** GET /api/expenses — List expenses (filterable by category, date range, paymentMode) */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const query = listExpensesSchema.parse(req.query)
    const result = await expenseService.listExpenses(businessId, query)
    sendSuccess(res, result)
  }),
)

/** GET /api/expenses/summary — Aggregated expense summary grouped by category */
router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const from = req.query.from ? new Date(String(req.query.from)) : undefined
    const to = req.query.to ? new Date(String(req.query.to)) : undefined
    const summary = await expenseService.getExpenseSummary(businessId, from, to)
    sendSuccess(res, summary)
  }),
)

/** GET /api/expenses/:id — Get a single expense */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const expense = await expenseService.getExpense(businessId, String(req.params.id))
    sendSuccess(res, expense)
  }),
)

/** PUT /api/expenses/:id — Update an expense */
router.put(
  '/:id',
  validate(updateExpenseSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const expense = await expenseService.updateExpense(
      businessId,
      String(req.params.id),
      req.body,
    )
    sendSuccess(res, expense)
  }),
)

/** DELETE /api/expenses/:id — Soft delete an expense */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const result = await expenseService.deleteExpense(businessId, String(req.params.id))
    sendSuccess(res, result)
  }),
)

export default router
