/**
 * Settings & Security Zod Schemas
 *
 * All schemas validate req.body directly (flat, no `body:` wrapper).
 */

import { z } from 'zod'

const APPROVAL_ACTIONS = ['APPROVE', 'DENY'] as const
const AUDIT_ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'LOCK_OVERRIDE', 'PIN_RESET', 'ROLE_CHANGE', 'APPROVAL_REQUEST', 'APPROVAL_RESPONSE'] as const

// === Roles ===

export const createRoleSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(200).optional(),
  permissions: z.array(z.string()).default([]),
  isDefault: z.boolean().default(false),
})

export const updateRoleSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(200).nullable().optional(),
  permissions: z.array(z.string()).optional(),
  isDefault: z.boolean().optional(),
})

// === Staff ===

export const inviteStaffSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().min(10).max(15),
  roleId: z.string().min(1),
})

export const updateStaffRoleSchema = z.object({
  roleId: z.string().min(1),
})

// === Transaction Lock ===

export const updateTransactionLockSchema = z.object({
  lockAfterDays: z.number().int().min(1).max(365).nullable().optional(),
  requireApprovalForEdit: z.boolean().optional(),
  requireApprovalForDelete: z.boolean().optional(),
  priceChangeThresholdPercent: z.number().min(0).max(100).nullable().optional(),
  discountThresholdPercent: z.number().min(0).max(100).nullable().optional(),
})

// === Approvals ===

export const reviewApprovalSchema = z.object({
  action: z.enum(APPROVAL_ACTIONS),
  reviewNote: z.string().max(500).optional(),
})

// === Audit Log ===

export const auditLogSchema = z.object({
  userId: z.string().optional(),
  entityType: z.string().optional(),
  action: z.enum(AUDIT_ACTIONS).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

// === App Settings ===

export const updateAppSettingsSchema = z.object({
  dateFormat: z.enum(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']).optional(),
  pinEnabled: z.boolean().optional(),
  biometricEnabled: z.boolean().optional(),
  calculatorPosition: z.enum(['BOTTOM_RIGHT', 'BOTTOM_LEFT']).optional(),
  language: z.string().max(5).optional(),
  theme: z.enum(['light', 'dark']).optional(),
})

// === PIN ===

export const setPinSchema = z.object({
  currentPin: z.string().min(4).max(6).optional(),
  newPin: z.string().min(4).max(6),
})

export const verifyPinSchema = z.object({
  pin: z.string().min(4).max(6),
})

export const setOperationPinSchema = z.object({
  currentPin: z.string().min(4).max(6).optional(),
  newPin: z.string().min(4).max(6),
})

// === Inferred types ===

export type CreateRoleInput = z.infer<typeof createRoleSchema>
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>
export type InviteStaffInput = z.infer<typeof inviteStaffSchema>
export type UpdateStaffRoleInput = z.infer<typeof updateStaffRoleSchema>
export type UpdateTransactionLockInput = z.infer<typeof updateTransactionLockSchema>
export type ReviewApprovalInput = z.infer<typeof reviewApprovalSchema>
export type AuditLogQuery = z.infer<typeof auditLogSchema>
export type UpdateAppSettingsInput = z.infer<typeof updateAppSettingsSchema>
export type SetPinInput = z.infer<typeof setPinSchema>
export type VerifyPinInput = z.infer<typeof verifyPinSchema>
