/**
 * Loyalty #125 — REST routes.
 *
 *   GET    /api/loyalty/program             → LoyaltyProgramDTO | null
 *   PUT    /api/loyalty/program             → LoyaltyProgramDTO
 *   GET    /api/loyalty/balance/:partyId    → LoyaltyBalanceDTO
 *   GET    /api/loyalty/ledger/:partyId     → LoyaltyLedgerPageDTO
 *
 * Auth: all routes require `auth` middleware. Permission rows:
 *   - loyalty.view      → GET program / balance / ledger
 *   - loyalty.configure → PUT program
 *
 * Cross-tenant 404 (NEW_S1 / test 12.16): balance + ledger PARTY-precheck
 * lives in `loyalty-balance.service.ts` (single SSOT of the lookup).
 */

import { Router } from 'express'
import { z } from 'zod'
import { auth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { requirePermission } from '../middleware/permission.js'
import { sendSuccess } from '../lib/response.js'
import {
  getProgram,
  upsertProgram,
  loyaltyProgramUpsertSchema,
} from '../services/loyalty/loyalty-program.service.js'
import { getBalance, listLedger } from '../services/loyalty/loyalty-balance.service.js'
import { LEDGER_PAGE_SIZE_DEFAULT, LEDGER_PAGE_SIZE_MAX } from '../services/loyalty/loyalty.constants.js'

const router = Router()

// ─── Context ───────────────────────────────────────────────────────────────

function getCtx(req: import('express').Request): { businessId: string; userId: string } {
  const user = req.user!
  return { businessId: user.businessId, userId: user.userId }
}

// ─── GET /program ──────────────────────────────────────────────────────────

router.get(
  '/program',
  auth,
  requirePermission('loyalty.view'),
  asyncHandler(async (req, res) => {
    const { businessId } = getCtx(req)
    const program = await getProgram(businessId)
    sendSuccess(res, { program })
  })
)

// ─── PUT /program ──────────────────────────────────────────────────────────

router.put(
  '/program',
  auth,
  requirePermission('loyalty.configure'),
  asyncHandler(async (req, res) => {
    const { businessId, userId } = getCtx(req)
    const input = loyaltyProgramUpsertSchema.parse(req.body)
    const program = await upsertProgram(businessId, userId, input)
    sendSuccess(res, { program })
  })
)

// ─── GET /balance/:partyId ────────────────────────────────────────────────

router.get(
  '/balance/:partyId',
  auth,
  requirePermission('loyalty.view'),
  asyncHandler(async (req, res) => {
    const { businessId } = getCtx(req)
    const balance = await getBalance(businessId, String(req.params.partyId))
    sendSuccess(res, balance)
  })
)

// ─── GET /ledger/:partyId ─────────────────────────────────────────────────

const ledgerQuerySchema = z
  .object({
    cursor: z.string().optional(),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(LEDGER_PAGE_SIZE_MAX)
      .optional()
      .default(LEDGER_PAGE_SIZE_DEFAULT),
  })
  .strict()

router.get(
  '/ledger/:partyId',
  auth,
  requirePermission('loyalty.view'),
  asyncHandler(async (req, res) => {
    const { businessId } = getCtx(req)
    const query = ledgerQuerySchema.parse(req.query)
    const page = await listLedger(businessId, String(req.params.partyId), query)
    sendSuccess(res, page)
  })
)

export default router
