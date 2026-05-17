/**
 * Commission #128 — REST routes.
 * Architecture: docs/ARCHITECTURE_EPIC_D_crm_loyalty.md §3.6, §6.3.
 *
 *   POST   /api/commission/rules                  → create rule
 *   PUT    /api/commission/rules/:id              → update rule
 *   DELETE /api/commission/rules/:id              → soft-delete rule
 *   GET    /api/commission/rules                  → list rules
 *   GET    /api/commission/rules/:id              → get one rule
 *   GET    /api/commission/ledger                 → ledger rows (own / other-staff)
 *   GET    /api/commission/leaderboard            → top-N staff for the month
 *
 * Permission matrix (architecture §6.1):
 *   commission.configure   → POST / PUT / DELETE /rules
 *   commission.view        → GET /rules · GET /ledger (own)
 *   commission.view_all    → GET /leaderboard · GET /ledger?staffUserId=<other>
 *
 * v3 / M4 — cross-tenant `staffUserId` precheck returns 404 STAFF_NOT_FOUND
 * (NOT 200-empty, NOT 403) — kills the UUID enumeration oracle.
 *
 * v3 / M5 — uses `commissionLedgerAuth` factory middleware (single-pass,
 * two terminals — no `res.headersSent` chain).
 *
 * Idempotency: rule CRUD writes carry standard Idempotency-Key headers via
 * the existing global idempotency middleware mounted on /api routes; we do
 * NOT need a per-route idempotency middleware here (rule CRUD is rare and
 * already user-driven).
 */

import { Router } from 'express'
import { auth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { requirePermission } from '../middleware/permission.js'
import { commissionLedgerAuth } from '../middleware/commission-ledger-auth.js'
import { sendSuccess } from '../lib/response.js'
import {
  createRule, updateRule, deleteRule, getRule, listRules,
} from '../services/commission/commission-rule.service.js'
import {
  listLedger, listLeaderboard, assertStaffInBusiness,
} from '../services/commission/commission-ledger.service.js'
import {
  commissionRuleInputSchema,
  commissionRuleUpdateSchema,
  commissionLedgerQuerySchema,
  commissionLeaderboardQuerySchema,
} from '../schemas/commission.schema.js'

const router = Router()

// ─── Context helper ────────────────────────────────────────────────────────

function getCtx(req: import('express').Request): { businessId: string; userId: string } {
  const user = req.user!
  return { businessId: user.businessId, userId: user.userId }
}

// ─── Rule CRUD ─────────────────────────────────────────────────────────────

router.post(
  '/rules',
  auth,
  requirePermission('commission.configure'),
  asyncHandler(async (req, res) => {
    const { businessId, userId } = getCtx(req)
    const input = commissionRuleInputSchema.parse(req.body)
    const rule = await createRule(businessId, userId, input)
    sendSuccess(res, { rule }, 201)
  })
)

router.put(
  '/rules/:id',
  auth,
  requirePermission('commission.configure'),
  asyncHandler(async (req, res) => {
    const { businessId } = getCtx(req)
    const input = commissionRuleUpdateSchema.parse(req.body)
    const rule = await updateRule(businessId, String(req.params.id), input)
    sendSuccess(res, { rule })
  })
)

router.delete(
  '/rules/:id',
  auth,
  requirePermission('commission.configure'),
  asyncHandler(async (req, res) => {
    const { businessId } = getCtx(req)
    await deleteRule(businessId, String(req.params.id))
    sendSuccess(res, { ok: true })
  })
)

router.get(
  '/rules',
  auth,
  requirePermission('commission.view'),
  asyncHandler(async (req, res) => {
    const { businessId } = getCtx(req)
    const includeInactive = req.query.includeInactive === 'true'
    const rules = await listRules(businessId, { includeInactive })
    sendSuccess(res, { rules })
  })
)

router.get(
  '/rules/:id',
  auth,
  requirePermission('commission.view'),
  asyncHandler(async (req, res) => {
    const { businessId } = getCtx(req)
    const rule = await getRule(businessId, String(req.params.id))
    sendSuccess(res, { rule })
  })
)

// ─── Ledger ────────────────────────────────────────────────────────────────

router.get(
  '/ledger',
  auth,
  // v3 / M5 — factory middleware. Single-pass, no `res.headersSent` chain.
  commissionLedgerAuth,
  asyncHandler(async (req, res) => {
    const { businessId, userId } = getCtx(req)
    const query = commissionLedgerQuerySchema.parse(req.query)
    const targetStaffUserId = query.staffUserId ?? userId

    // v3 / M4 — Cross-tenant precheck. Returns 404 STAFF_NOT_FOUND when the
    // requested UUID is not a member of caller's tenant. NOT 200-empty (leaks
    // "this UUID is a real user somewhere"), NOT 403 (leaks "I exist but
    // you don't own me"). Both are UUID enumeration oracles.
    if (targetStaffUserId !== userId) {
      await assertStaffInBusiness(businessId, targetStaffUserId)
    }

    const page = await listLedger(businessId, {
      staffUserId: targetStaffUserId,
      periodYearMonth: query.periodYearMonth,
      cursor: query.cursor,
      limit: query.limit,
    })
    sendSuccess(res, page)
  })
)

// ─── Leaderboard ───────────────────────────────────────────────────────────

router.get(
  '/leaderboard',
  auth,
  requirePermission('commission.view_all'),
  asyncHandler(async (req, res) => {
    const { businessId } = getCtx(req)
    const query = commissionLeaderboardQuerySchema.parse(req.query)
    const entries = await listLeaderboard(businessId, {
      periodYearMonth: query.periodYearMonth,
      limit: query.limit,
    })
    sendSuccess(res, { entries, periodYearMonth: query.periodYearMonth })
  })
)

export default router
