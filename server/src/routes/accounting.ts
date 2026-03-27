/**
 * Accounting Routes — Chart of Accounts, Journal Entries, and Financial Reports.
 * All routes require auth. businessId resolved from user's active BusinessUser record.
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission.js'
import { sendSuccess } from '../lib/response.js'
import {
  createLedgerAccountSchema,
  updateLedgerAccountSchema,
  listLedgerAccountsSchema,
  createJournalEntrySchema,
  listJournalEntriesSchema,
  voidJournalEntrySchema,
  trialBalanceQuerySchema,
  ledgerReportQuerySchema,
  dayBookQuerySchema,
} from '../schemas/accounting.schemas.js'
import * as accountingService from '../services/accounting.service.js'

const router = Router()

router.use(auth)

// ─── Chart of Accounts ─────────────────────────────────────────────────────────

/** POST /api/accounting/accounts — Create a new ledger account */
router.post(
  '/accounts',
  requirePermission('accounting.create'),
  validate(createLedgerAccountSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const account = await accountingService.createLedgerAccount(businessId, req.body)
    sendSuccess(res, account, 201)
  }),
)

/** GET /api/accounting/accounts — List ledger accounts (filterable, paginated) */
router.get(
  '/accounts',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const query = listLedgerAccountsSchema.parse(req.query)
    const result = await accountingService.listLedgerAccounts(businessId, query)
    sendSuccess(res, result)
  }),
)

/** POST /api/accounting/accounts/seed — Seed default chart of accounts (idempotent) */
router.post(
  '/accounts/seed',
  requirePermission('accounting.create'),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const result = await accountingService.seedDefaultAccounts(businessId)
    sendSuccess(res, result)
  }),
)

/** GET /api/accounting/accounts/:id — Get a single ledger account with children */
router.get(
  '/accounts/:id',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const account = await accountingService.getLedgerAccount(businessId, String(req.params.id))
    sendSuccess(res, account)
  }),
)

/** PUT /api/accounting/accounts/:id — Update a ledger account */
router.put(
  '/accounts/:id',
  requirePermission('accounting.edit'),
  validate(updateLedgerAccountSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const account = await accountingService.updateLedgerAccount(
      businessId,
      String(req.params.id),
      req.body,
    )
    sendSuccess(res, account)
  }),
)

// ─── Journal Entries ────────────────────────────────────────────────────────────

/** POST /api/accounting/entries — Create a new journal entry (DRAFT) */
router.post(
  '/entries',
  requirePermission('accounting.create'),
  validate(createJournalEntrySchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const entry = await accountingService.createJournalEntry(
      businessId,
      req.user!.userId,
      req.body,
    )
    sendSuccess(res, entry, 201)
  }),
)

/** GET /api/accounting/entries — List journal entries (filterable, paginated) */
router.get(
  '/entries',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const query = listJournalEntriesSchema.parse(req.query)
    const result = await accountingService.listJournalEntries(businessId, query)
    sendSuccess(res, result)
  }),
)

/** GET /api/accounting/entries/:id — Get a single journal entry with lines */
router.get(
  '/entries/:id',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const entry = await accountingService.getJournalEntry(businessId, String(req.params.id))
    sendSuccess(res, entry)
  }),
)

/** POST /api/accounting/entries/:id/post — Post a DRAFT journal entry */
router.post(
  '/entries/:id/post',
  requirePermission('accounting.edit'),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const entry = await accountingService.postJournalEntry(businessId, String(req.params.id))
    sendSuccess(res, entry)
  }),
)

/** POST /api/accounting/entries/:id/void — Void a DRAFT or POSTED journal entry */
router.post(
  '/entries/:id/void',
  requirePermission('accounting.delete'),
  validate(voidJournalEntrySchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const entry = await accountingService.voidJournalEntry(
      businessId,
      String(req.params.id),
      req.user!.userId,
      req.body.reason,
    )
    sendSuccess(res, entry)
  }),
)

// ─── Reports ───────────────────────────────────────────────────────────────────

/** GET /api/accounting/reports/trial-balance — Trial balance as of a given date */
router.get(
  '/reports/trial-balance',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const query = trialBalanceQuerySchema.parse(req.query)
    const result = await accountingService.getTrialBalance(businessId, query.asOf)
    sendSuccess(res, result)
  }),
)

/** GET /api/accounting/reports/ledger/:accountId — Ledger report for an account */
router.get(
  '/reports/ledger/:accountId',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const query = ledgerReportQuerySchema.parse(req.query)
    const result = await accountingService.getLedgerReport(
      businessId,
      String(req.params.accountId),
      query.from,
      query.to,
    )
    sendSuccess(res, result)
  }),
)

/** GET /api/accounting/reports/day-book — Day book for a given date */
router.get(
  '/reports/day-book',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const query = dayBookQuerySchema.parse(req.query)
    const result = await accountingService.getDayBook(businessId, query.date)
    sendSuccess(res, result)
  }),
)

export default router
