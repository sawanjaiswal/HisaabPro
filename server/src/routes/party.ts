/**
 * Party Management Routes
 * All routes require auth. businessId resolved from user's active BusinessUser record.
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { userMutationLimiter } from '../middleware/rate-limit.js'
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
import * as partyService from '../services/party.service.js'

const router = Router()

// All party routes require auth
router.use(auth)
router.use(userMutationLimiter)
router.use(requireFeature('parties'))

// ============================================================
// Parties
// ============================================================

/**
 * POST /api/parties
 * Create a new party (customer, supplier, or both)
 */
router.post(
  '/',
  requirePermission('parties.create'),
  validate(createPartySchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const party = await partyService.createParty(businessId, req.body)
    sendSuccess(res, { party }, 201)
  })
)

/**
 * GET /api/parties
 * List parties with search, filters, sorting, and pagination
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const query = listPartiesSchema.parse(req.query)
    const result = await partyService.listParties(businessId, query)
    sendSuccess(res, result)
  })
)

/**
 * GET /api/parties/:id
 * Get full party detail including addresses, custom fields, opening balance
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const partyId = String(req.params.id)
    const party = await partyService.getParty(businessId, partyId)
    sendSuccess(res, { party })
  })
)

/**
 * PUT /api/parties/:id
 * Partial update a party
 */
router.put(
  '/:id',
  requirePermission('parties.edit'),
  validate(updatePartySchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const partyId = String(req.params.id)
    const party = await partyService.updateParty(businessId, partyId, req.body)
    sendSuccess(res, { party })
  })
)

/**
 * DELETE /api/parties/:id
 * Soft delete (isActive=false) by default. ?force=true for hard delete.
 */
router.delete(
  '/:id',
  requirePermission('parties.delete'),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const partyId = String(req.params.id)
    const force = req.query.force === 'true'
    const result = await partyService.deleteParty(businessId, partyId, force)
    sendSuccess(res, result)
  })
)

// ============================================================
// Addresses
// ============================================================

/**
 * POST /api/parties/:partyId/addresses
 * Add a new address to a party
 */
router.post(
  '/:partyId/addresses',
  requirePermission('parties.edit'),
  validate(createAddressSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const partyId = String(req.params.partyId)
    const address = await partyService.createAddress(businessId, partyId, req.body)
    sendSuccess(res, { address }, 201)
  })
)

/**
 * PUT /api/parties/:partyId/addresses/:addressId
 * Update an address
 */
router.put(
  '/:partyId/addresses/:addressId',
  requirePermission('parties.edit'),
  validate(updateAddressSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const partyId = String(req.params.partyId)
    const addressId = String(req.params.addressId)
    const address = await partyService.updateAddress(businessId, partyId, addressId, req.body)
    sendSuccess(res, { address })
  })
)

/**
 * DELETE /api/parties/:partyId/addresses/:addressId
 * Delete an address (prevents deleting last billing address)
 */
router.delete(
  '/:partyId/addresses/:addressId',
  requirePermission('parties.delete'),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const partyId = String(req.params.partyId)
    const addressId = String(req.params.addressId)
    const result = await partyService.deleteAddress(businessId, partyId, addressId)
    sendSuccess(res, result)
  })
)

// ============================================================
// Ledger Shares (stub — feature not yet implemented)
// ============================================================

// PartyDetailPage queries this on every load via useShareLedger.
// Until the share-link feature ships, return an empty list so the page
// doesn't surface 404s in the network panel.
router.get(
  '/:partyId/ledger/shares',
  asyncHandler(async (_req, res) => {
    sendSuccess(res, [])
  })
)

// ============================================================
// Party Pricing
// ============================================================

/**
 * PUT /api/parties/:partyId/pricing
 * Bulk upsert pricing overrides for a party
 */
router.put(
  '/:partyId/pricing',
  requirePermission('parties.edit'),
  validate(setPricingSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const partyId = String(req.params.partyId)
    const pricing = await partyService.setPricing(businessId, partyId, req.body)
    sendSuccess(res, { pricing })
  })
)

/**
 * GET /api/parties/:partyId/pricing
 * List pricing overrides for a party (paginated)
 */
router.get(
  '/:partyId/pricing',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const partyId = String(req.params.partyId)
    const query = listPricingQuerySchema.parse(req.query)
    const result = await partyService.getPartyPricing(
      businessId,
      partyId,
      query.search,
      query.page,
      query.limit
    )
    sendSuccess(res, result)
  })
)

export default router
