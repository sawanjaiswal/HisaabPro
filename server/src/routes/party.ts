/**
 * Party Management Routes
 * All routes require auth. businessId resolved from user's active BusinessUser record.
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { requireActiveBusiness } from '../middleware/require-active-business.js'
import { userMutationLimiter, createRateLimiter } from '../middleware/rate-limit.js'
import { requireFeature } from '../middleware/subscription-gate.js'
import { sendSuccess } from '../lib/response.js'
import {
  createPartySchema,
  updatePartySchema,
  listPartiesSchema,
  createAddressSchema,
  updateAddressSchema,
  setPricingSchema,
  listPricingQuerySchema,
} from '../schemas/party.schemas.js'
import { requirePermission } from '../middleware/permission.js'
import { replayProtection } from '../middleware/replay-protection.js'
import { idempotencyCheck } from '../middleware/idempotency.js'
import * as partyService from '../services/party.service.js'
import { getPartyLedger } from '../services/party/ledger.service.js'
import { ledgerQuerySchema } from '../services/party/ledger.types.js'
import partyInviteRoutes from './parties/invite.routes.js'
import crmRoutes from './parties/crm.routes.js'

// 30 req/min per user for ledger (read-heavy, can be intensive)
const ledgerRateLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 30,
  message: 'Too many ledger requests. Please slow down.',
  keyFn: (req) => `rl:ledger:${req.user?.userId ?? req.ip ?? 'unknown'}`,
})

const router = Router()

// All party routes require auth + an active (non-suspended) firm membership.
// Phase 6 #138 PR2 — gate fires 403 FIRM_SUSPENDED / MEMBER_SUSPENDED so the
// FE can show "your firm has been paused" and block further mutations.
router.use(auth)
router.use(requireActiveBusiness)
router.use(userMutationLimiter)
router.use(requireFeature('parties'))

// Parties CRUD ---------------------------------------------------------------
router.post(
  '/',
  requirePermission('parties.create'),
  replayProtection,
  idempotencyCheck(),
  validate(createPartySchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const party = await partyService.createParty(businessId, req.body)
    sendSuccess(res, { party }, 201)
  })
)

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const query = listPartiesSchema.parse(req.query)
    const result = await partyService.listParties(businessId, query)
    sendSuccess(res, result)
  })
)

// CRM #127 — tags + follow-ups + narrow PATCH live in crm.routes.ts sub-router.
// MUST be mounted BEFORE the dynamic `/:id` GET so literal paths (`/tags`,
// `/follow-ups`) are not swallowed. PATCH inside crm.routes.ts also wins
// over PUT below because Express dispatches by method per path.
router.use('/', crmRoutes)

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const party = await partyService.getParty(businessId, String(req.params.id))
    sendSuccess(res, { party })
  })
)

router.put(
  '/:id',
  requirePermission('parties.edit'),
  validate(updatePartySchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const userId = req.user!.userId
    const party = await partyService.updateParty(businessId, String(req.params.id), userId, req.body)
    sendSuccess(res, { party })
  })
)

router.delete(
  '/:id',
  requirePermission('parties.delete'),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const userId = req.user!.userId
    const force = req.query.force === 'true'
    const result = await partyService.deleteParty(businessId, String(req.params.id), userId, force)
    sendSuccess(res, result)
  })
)

// Addresses ------------------------------------------------------------------
router.post(
  '/:partyId/addresses',
  requirePermission('parties.edit'),
  validate(createAddressSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const address = await partyService.createAddress(businessId, String(req.params.partyId), req.body)
    sendSuccess(res, { address }, 201)
  })
)

router.put(
  '/:partyId/addresses/:addressId',
  requirePermission('parties.edit'),
  validate(updateAddressSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const address = await partyService.updateAddress(
      businessId,
      String(req.params.partyId),
      String(req.params.addressId),
      req.body
    )
    sendSuccess(res, { address })
  })
)

router.delete(
  '/:partyId/addresses/:addressId',
  requirePermission('parties.delete'),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const result = await partyService.deleteAddress(
      businessId,
      String(req.params.partyId),
      String(req.params.addressId)
    )
    sendSuccess(res, result)
  })
)

// Ledger ---------------------------------------------------------------------
router.get(
  '/:partyId/ledger',
  requirePermission('parties.read'),
  ledgerRateLimiter,
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const query = ledgerQuerySchema.parse(req.query)
    const data = await getPartyLedger(businessId, String(req.params.partyId), query)
    sendSuccess(res, data)
  })
)

// Backwards-compat stub for PartyDetailPage; real share-links is a separate scope.
router.get(
  '/:partyId/ledger/shares',
  asyncHandler(async (_req, res) => {
    sendSuccess(res, [])
  })
)

// Pricing --------------------------------------------------------------------
router.put(
  '/:partyId/pricing',
  requirePermission('parties.edit'),
  validate(setPricingSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const pricing = await partyService.setPricing(businessId, String(req.params.partyId), req.body)
    sendSuccess(res, { pricing })
  })
)

router.get(
  '/:partyId/pricing',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const query = listPricingQuerySchema.parse(req.query)
    const result = await partyService.getPartyPricing(
      businessId,
      String(req.params.partyId),
      query.search,
      query.page,
      query.limit
    )
    sendSuccess(res, result)
  })
)

// Invite portal (#131) -------------------------------------------------------
router.use('/:partyId/invite', partyInviteRoutes)

export default router
