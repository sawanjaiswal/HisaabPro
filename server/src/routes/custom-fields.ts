/**
 * Custom Field Routes
 * Mounted at /api/custom-fields
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { sendSuccess } from '../lib/response.js'
import { prisma } from '../lib/prisma.js'
import { unauthorizedError } from '../lib/errors.js'
import {
  createCustomFieldSchema,
  updateCustomFieldSchema,
} from '../schemas/party.schemas.js'
import * as partyService from '../services/party.service.js'

const router = Router()

router.use(auth)

async function resolveBusinessId(userId: string): Promise<string> {
  const bu = await prisma.businessUser.findFirst({
    where: { userId, isActive: true },
    select: { businessId: true },
  })
  if (!bu) throw unauthorizedError('No active business found for this user')
  return bu.businessId
}

/**
 * POST /api/custom-fields
 */
router.post(
  '/',
  validate(createCustomFieldSchema),
  asyncHandler(async (req, res) => {
    const businessId = await resolveBusinessId(req.user!.userId)
    const field = await partyService.createCustomField(businessId, req.body)
    sendSuccess(res, { field }, 201)
  })
)

/**
 * GET /api/custom-fields
 * Query: entityType (PARTY | PRODUCT | INVOICE)
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const businessId = await resolveBusinessId(req.user!.userId)
    const entityType = typeof req.query.entityType === 'string'
      ? req.query.entityType
      : undefined
    const fields = await partyService.listCustomFields(businessId, entityType)
    sendSuccess(res, { fields })
  })
)

/**
 * PUT /api/custom-fields/:id
 */
router.put(
  '/:id',
  validate(updateCustomFieldSchema),
  asyncHandler(async (req, res) => {
    const businessId = await resolveBusinessId(req.user!.userId)
    const fieldId = String(req.params.id)
    const field = await partyService.updateCustomField(businessId, fieldId, req.body)
    sendSuccess(res, { field })
  })
)

/**
 * DELETE /api/custom-fields/:id
 */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const businessId = await resolveBusinessId(req.user!.userId)
    const fieldId = String(req.params.id)
    const result = await partyService.deleteCustomField(businessId, fieldId)
    sendSuccess(res, result)
  })
)

export default router
