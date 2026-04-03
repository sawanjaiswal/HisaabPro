/**
 * Settings & Security Routes
 * Business-scoped: /api/businesses/:businessId/...
 * User-scoped: /api/users/:userId/...
 * Static: /api/permissions/matrix
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { sensitiveMutationLimiter } from '../middleware/rate-limit.js'
import { sendSuccess } from '../lib/response.js'
import { validationError } from '../lib/errors.js'
import {
  createRoleSchema,
  updateRoleSchema,
  inviteStaffSchema,
  updateStaffRoleSchema,
  updateTransactionLockSchema,
  reviewApprovalSchema,
  auditLogSchema,
  updateAppSettingsSchema,
  setPinSchema,
  verifyPinSchema,
  setOperationPinSchema,
  updateGstSettingsSchema,
} from '../schemas/settings.schemas.js'
import { joinBusinessSchema } from '../schemas/auth.schemas.js'
import { createBusinessSchema, updateBusinessSchema } from '../schemas/business.schemas.js'
import { requireOwner } from '../middleware/permission.js'
import { requirePlan, requireQuota } from '../middleware/subscription-gate.js'
import * as settingsService from '../services/settings.service.js'
import * as businessService from '../services/business.service.js'
import * as authService from '../services/auth.service.js'
import * as gstService from '../services/gst-settings.service.js'

// === Business-scoped routes ===

export const businessSettingsRouter = Router()
businessSettingsRouter.use(auth)

// --- Create Business (onboarding) ---

businessSettingsRouter.post('/', validate(createBusinessSchema), asyncHandler(async (req, res) => {
  const userId = req.user!.userId
  const business = await businessService.createBusiness(userId, req.body)
  sendSuccess(res, { business }, 201)
}))

// --- List User's Businesses ---

businessSettingsRouter.get('/', asyncHandler(async (req, res) => {
  const businesses = await authService.listUserBusinesses(req.user!.userId)
  sendSuccess(res, { businesses })
}))

// --- Join Business via Invite Code ---

businessSettingsRouter.post('/join', sensitiveMutationLimiter, validate(joinBusinessSchema), asyncHandler(async (req, res) => {
  const { userId, phone } = req.user!
  const result = await settingsService.joinBusiness(userId, phone, req.body.code)
  sendSuccess(res, result, 201)
}))

// --- Business Profile ---

businessSettingsRouter.get('/:businessId', asyncHandler(async (req, res) => {
  // Use JWT businessId — user can only view their active business profile
  const businessId = req.user!.businessId
  const business = await businessService.getBusiness(businessId)
  sendSuccess(res, business)
}))

businessSettingsRouter.put('/:businessId', requireOwner(), validate(updateBusinessSchema), asyncHandler(async (req, res) => {
  const businessId = req.user!.businessId
  const business = await businessService.updateBusiness(businessId, req.body)
  sendSuccess(res, business)
}))

// --- Roles ---

businessSettingsRouter.get('/:businessId/roles', asyncHandler(async (req, res) => {
  const businessId = req.user!.businessId
  const roles = await settingsService.listRoles(businessId)
  sendSuccess(res, roles)
}))

businessSettingsRouter.get('/:businessId/roles/:roleId', asyncHandler(async (req, res) => {
  const businessId = req.user!.businessId
  const role = await settingsService.getRole(businessId, String(req.params.roleId))
  sendSuccess(res, role)
}))

businessSettingsRouter.post('/:businessId/roles', requirePlan('PRO'), requireOwner(), validate(createRoleSchema), asyncHandler(async (req, res) => {
  const businessId = req.user!.businessId
  const role = await settingsService.createRole(businessId, req.body)
  sendSuccess(res, role, 201)
}))

businessSettingsRouter.put('/:businessId/roles/:roleId', requirePlan('PRO'), requireOwner(), validate(updateRoleSchema), asyncHandler(async (req, res) => {
  const businessId = req.user!.businessId
  const role = await settingsService.updateRole(businessId, String(req.params.roleId), req.body)
  sendSuccess(res, role)
}))

businessSettingsRouter.delete('/:businessId/roles/:roleId', requireOwner(), asyncHandler(async (req, res) => {
  const businessId = req.user!.businessId
  const reassignTo = req.query.reassignTo as string
  if (!reassignTo) throw validationError('reassignTo query param is required')
  const result = await settingsService.deleteRole(businessId, String(req.params.roleId), reassignTo)
  sendSuccess(res, result)
}))

// --- Staff ---

businessSettingsRouter.get('/:businessId/staff', asyncHandler(async (req, res) => {
  const businessId = req.user!.businessId
  const data = await settingsService.listStaff(businessId)
  sendSuccess(res, data)
}))

businessSettingsRouter.post('/:businessId/staff/invite', requireQuota('users'), requireOwner(), sensitiveMutationLimiter, validate(inviteStaffSchema), asyncHandler(async (req, res) => {
  const userId = req.user!.userId
  const businessId = req.user!.businessId
  const data = await settingsService.inviteStaff(businessId, userId, req.body)
  sendSuccess(res, data, 201)
}))

businessSettingsRouter.put('/:businessId/staff/:staffId', requireOwner(), validate(updateStaffRoleSchema), asyncHandler(async (req, res) => {
  const businessId = req.user!.businessId
  const data = await settingsService.updateStaffRole(businessId, String(req.params.staffId), req.body)
  sendSuccess(res, data)
}))

businessSettingsRouter.post('/:businessId/staff/:staffId/suspend', requireOwner(), asyncHandler(async (req, res) => {
  const businessId = req.user!.businessId
  const data = await settingsService.suspendStaff(businessId, String(req.params.staffId))
  sendSuccess(res, data)
}))

businessSettingsRouter.delete('/:businessId/staff/:staffId', requireOwner(), asyncHandler(async (req, res) => {
  const businessId = req.user!.businessId
  const staffId = String(req.params.staffId)
  await settingsService.removeStaff(businessId, staffId)
  sendSuccess(res, { staffId, removedAt: new Date().toISOString() })
}))

businessSettingsRouter.post('/:businessId/staff/invite/:inviteId/resend', requireOwner(), asyncHandler(async (req, res) => {
  const businessId = req.user!.businessId
  const data = await settingsService.resendInvite(businessId, String(req.params.inviteId))
  sendSuccess(res, data)
}))

businessSettingsRouter.delete('/:businessId/staff/invite/:inviteId', requireOwner(), asyncHandler(async (req, res) => {
  const businessId = req.user!.businessId
  const data = await settingsService.cancelInvite(businessId, String(req.params.inviteId))
  sendSuccess(res, data)
}))

// --- Transaction Lock ---

businessSettingsRouter.get('/:businessId/settings/transaction-lock', asyncHandler(async (req, res) => {
  const businessId = req.user!.businessId
  const config = await settingsService.getTransactionLock(businessId)
  sendSuccess(res, config)
}))

businessSettingsRouter.put('/:businessId/settings/transaction-lock', requireOwner(), validate(updateTransactionLockSchema), asyncHandler(async (req, res) => {
  const businessId = req.user!.businessId
  const config = await settingsService.updateTransactionLock(businessId, req.body)
  sendSuccess(res, config)
}))

// --- Approvals ---

businessSettingsRouter.get('/:businessId/approvals', asyncHandler(async (req, res) => {
  const businessId = req.user!.businessId
  const status = req.query.status as string | undefined
  const page = Number(req.query.page) || 1
  const limit = Number(req.query.limit) || 50
  const data = await settingsService.listApprovals(businessId, status, page, limit)
  sendSuccess(res, data)
}))

businessSettingsRouter.put('/:businessId/approvals/:approvalId', requireOwner(), validate(reviewApprovalSchema), asyncHandler(async (req, res) => {
  const userId = req.user!.userId
  const businessId = req.user!.businessId
  const data = await settingsService.reviewApproval(businessId, String(req.params.approvalId), userId, req.body)
  sendSuccess(res, data)
}))

// --- Audit Log ---

businessSettingsRouter.get('/:businessId/audit-log', asyncHandler(async (req, res) => {
  const businessId = req.user!.businessId
  const query = auditLogSchema.parse(req.query)
  const data = await settingsService.listAuditLog(businessId, query)
  sendSuccess(res, data)
}))

// --- GST Settings ---

businessSettingsRouter.get('/:businessId/gst-settings', asyncHandler(async (req, res) => {
  const businessId = req.user!.businessId
  const data = await gstService.getGstSettings(businessId)
  sendSuccess(res, data)
}))

businessSettingsRouter.put('/:businessId/gst-settings', requireOwner(), validate(updateGstSettingsSchema), asyncHandler(async (req, res) => {
  const businessId = req.user!.businessId
  const data = await gstService.updateGstSettings(businessId, req.body)
  sendSuccess(res, data)
}))

// --- Operation PIN ---

businessSettingsRouter.post('/:businessId/operation-pin', requireOwner(), validate(setOperationPinSchema), asyncHandler(async (req, res) => {
  const businessId = req.user!.businessId
  const data = await settingsService.setOperationPin(businessId, req.body)
  sendSuccess(res, data)
}))

// === User-scoped routes ===

export const userSettingsRouter = Router()
userSettingsRouter.use(auth)

// --- App Settings ---

userSettingsRouter.get('/:userId/settings', asyncHandler(async (req, res) => {
  const userId = req.user!.userId
  const data = await settingsService.getAppSettings(userId)
  sendSuccess(res, data)
}))

userSettingsRouter.put('/:userId/settings', validate(updateAppSettingsSchema), asyncHandler(async (req, res) => {
  const userId = req.user!.userId
  const data = await settingsService.updateAppSettings(userId, req.body)
  sendSuccess(res, data)
}))

// --- PIN ---

userSettingsRouter.post('/:userId/pin', validate(setPinSchema), asyncHandler(async (req, res) => {
  const userId = req.user!.userId
  const data = await settingsService.setPin(userId, req.body)
  sendSuccess(res, data)
}))

userSettingsRouter.post('/:userId/pin/verify', validate(verifyPinSchema), asyncHandler(async (req, res) => {
  const userId = req.user!.userId
  const data = await settingsService.verifyPin(userId, req.body)
  sendSuccess(res, data)
}))

userSettingsRouter.post('/:userId/pin/reset', validate(setPinSchema), asyncHandler(async (req, res) => {
  const userId = req.user!.userId
  const data = await settingsService.setPin(userId, req.body)
  sendSuccess(res, data)
}))

// === Static routes ===

export const permissionsRouter = Router()
permissionsRouter.use(auth)

permissionsRouter.get('/matrix', asyncHandler(async (_req, res) => {
  const data = settingsService.getPermissionMatrix()
  sendSuccess(res, data)
}))
