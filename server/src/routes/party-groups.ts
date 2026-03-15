/**
 * Party Group Routes
 * Mounted at /api/party-groups
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { sendSuccess } from '../lib/response.js'
import { resolveBusinessId } from '../lib/business.js'
import {
  createGroupSchema,
  updateGroupSchema,
  deleteGroupSchema,
} from '../schemas/party.schemas.js'
import * as partyService from '../services/party.service.js'

const router = Router()

router.use(auth)

/**
 * POST /api/party-groups
 */
router.post(
  '/',
  validate(createGroupSchema),
  asyncHandler(async (req, res) => {
    const businessId = await resolveBusinessId(req.user!.userId)
    const group = await partyService.createGroup(businessId, req.body)
    sendSuccess(res, { group }, 201)
  })
)

/**
 * GET /api/party-groups
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const businessId = await resolveBusinessId(req.user!.userId)
    const groups = await partyService.listGroups(businessId)
    sendSuccess(res, { groups })
  })
)

/**
 * PUT /api/party-groups/:id
 */
router.put(
  '/:id',
  validate(updateGroupSchema),
  asyncHandler(async (req, res) => {
    const businessId = await resolveBusinessId(req.user!.userId)
    const groupId = String(req.params.id)
    const group = await partyService.updateGroup(businessId, groupId, req.body)
    sendSuccess(res, { group })
  })
)

/**
 * DELETE /api/party-groups/:id
 * Body: { reassignTo?: string }
 */
router.delete(
  '/:id',
  validate(deleteGroupSchema),
  asyncHandler(async (req, res) => {
    const businessId = await resolveBusinessId(req.user!.userId)
    const groupId = String(req.params.id)
    const result = await partyService.deleteGroup(
      businessId,
      groupId,
      req.body.reassignTo as string | undefined
    )
    sendSuccess(res, result)
  })
)

export default router
