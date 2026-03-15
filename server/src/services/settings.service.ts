/**
 * Settings Service — Roles, Staff, Transaction Lock, Approvals, Audit, App Settings, PIN
 */

import crypto from 'crypto'
import { prisma } from '../lib/prisma.js'
import { notFoundError, validationError, conflictError, unauthorizedError } from '../lib/errors.js'
import { hashPassword, verifyPassword } from '../lib/password.js'
import type {
  CreateRoleInput,
  UpdateRoleInput,
  InviteStaffInput,
  UpdateStaffRoleInput,
  UpdateTransactionLockInput,
  ReviewApprovalInput,
  AuditLogQuery,
  UpdateAppSettingsInput,
  SetPinInput,
  VerifyPinInput,
} from '../schemas/settings.schemas.js'

// === Permission Matrix (static) ===

const PERMISSION_MATRIX = [
  {
    key: 'invoicing', label: 'Invoicing',
    actions: [
      { key: 'view', label: 'View Invoices' },
      { key: 'create', label: 'Create Invoices' },
      { key: 'edit', label: 'Edit Invoices' },
      { key: 'delete', label: 'Delete Invoices' },
      { key: 'share', label: 'Share Invoices' },
    ],
  },
  {
    key: 'inventory', label: 'Inventory',
    actions: [
      { key: 'view', label: 'View Products' },
      { key: 'create', label: 'Create Products' },
      { key: 'edit', label: 'Edit Products' },
      { key: 'delete', label: 'Delete Products' },
      { key: 'adjustStock', label: 'Adjust Stock' },
    ],
  },
  {
    key: 'payments', label: 'Payments',
    actions: [
      { key: 'view', label: 'View Payments' },
      { key: 'record', label: 'Record Payments' },
      { key: 'edit', label: 'Edit Payments' },
      { key: 'delete', label: 'Delete Payments' },
    ],
  },
  {
    key: 'parties', label: 'Parties',
    actions: [
      { key: 'view', label: 'View Parties' },
      { key: 'create', label: 'Create Parties' },
      { key: 'edit', label: 'Edit Parties' },
      { key: 'delete', label: 'Delete Parties' },
    ],
  },
  {
    key: 'reports', label: 'Reports',
    actions: [
      { key: 'view', label: 'View Reports' },
      { key: 'download', label: 'Download Reports' },
    ],
  },
  {
    key: 'settings', label: 'Settings',
    actions: [
      { key: 'view', label: 'View Settings' },
      { key: 'modify', label: 'Modify Settings' },
      { key: 'manageStaff', label: 'Manage Staff' },
    ],
  },
  {
    key: 'fields', label: 'Sensitive Fields',
    actions: [
      { key: 'viewPurchasePrice', label: 'View Purchase Price' },
      { key: 'viewProfitMargin', label: 'View Profit Margin' },
      { key: 'viewPartyPhone', label: 'View Party Phone' },
      { key: 'viewPartyOutstanding', label: 'View Party Outstanding' },
    ],
  },
]

export function getPermissionMatrix() {
  return { modules: PERMISSION_MATRIX }
}

// === System Roles (lazy-seeded per business) ===

const SYSTEM_ROLES = [
  {
    name: 'Owner',
    isSystem: true,
    priority: 100,
    permissions: PERMISSION_MATRIX.flatMap(m =>
      m.actions.map(a => `${m.key}.${a.key}`)
    ),
  },
  {
    name: 'Manager',
    isSystem: true,
    priority: 50,
    permissions: PERMISSION_MATRIX.flatMap(m =>
      m.actions.map(a => `${m.key}.${a.key}`)
    ).filter(p => !p.startsWith('settings.manageStaff')),
  },
  {
    name: 'Billing Staff',
    isSystem: true,
    priority: 20,
    permissions: [
      'invoicing.view', 'invoicing.create', 'invoicing.edit', 'invoicing.share',
      'inventory.view',
      'payments.view', 'payments.record',
      'parties.view',
      'reports.view',
    ],
  },
  {
    name: 'Viewer',
    isSystem: true,
    isDefault: true,
    priority: 10,
    permissions: [
      'invoicing.view', 'inventory.view', 'payments.view',
      'parties.view', 'reports.view',
    ],
  },
]

async function ensureSystemRoles(businessId: string) {
  const existing = await prisma.role.count({ where: { businessId, isSystem: true } })
  if (existing >= SYSTEM_ROLES.length) return

  for (const role of SYSTEM_ROLES) {
    await prisma.role.upsert({
      where: { businessId_name: { businessId, name: role.name } },
      create: {
        businessId,
        name: role.name,
        isSystem: true,
        isDefault: role.isDefault || false,
        priority: role.priority,
        permissions: role.permissions,
      },
      update: {},
    })
  }
}

// === Roles ===

export async function listRoles(businessId: string) {
  await ensureSystemRoles(businessId)

  return prisma.role.findMany({
    where: { businessId },
    select: {
      id: true, name: true, description: true, isSystem: true,
      isDefault: true, priority: true, permissions: true,
      createdAt: true, updatedAt: true,
      _count: { select: { businessUsers: true } },
    },
    orderBy: { priority: 'desc' },
  })
}

export async function getRole(businessId: string, roleId: string) {
  const role = await prisma.role.findFirst({
    where: { id: roleId, businessId },
    select: {
      id: true, name: true, description: true, isSystem: true,
      isDefault: true, priority: true, permissions: true,
      createdAt: true, updatedAt: true,
      _count: { select: { businessUsers: true } },
    },
  })
  if (!role) throw notFoundError('Role')
  return role
}

export async function createRole(businessId: string, data: CreateRoleInput) {
  if (data.isDefault) {
    await prisma.role.updateMany({
      where: { businessId, isDefault: true },
      data: { isDefault: false },
    })
  }

  return prisma.role.create({
    data: {
      businessId,
      name: data.name,
      description: data.description || null,
      permissions: data.permissions,
      isDefault: data.isDefault,
    },
    select: {
      id: true, name: true, description: true, isSystem: true,
      isDefault: true, priority: true, permissions: true,
      createdAt: true, updatedAt: true,
    },
  })
}

export async function updateRole(businessId: string, roleId: string, data: UpdateRoleInput) {
  const role = await prisma.role.findFirst({
    where: { id: roleId, businessId },
    select: { isSystem: true },
  })
  if (!role) throw notFoundError('Role')
  if (role.isSystem) throw validationError('Cannot modify system roles')

  if (data.isDefault) {
    await prisma.role.updateMany({
      where: { businessId, isDefault: true, id: { not: roleId } },
      data: { isDefault: false },
    })
  }

  return prisma.role.update({
    where: { id: roleId },
    data,
    select: {
      id: true, name: true, description: true, isSystem: true,
      isDefault: true, priority: true, permissions: true,
      createdAt: true, updatedAt: true,
    },
  })
}

export async function deleteRole(businessId: string, roleId: string, reassignToId: string) {
  const role = await prisma.role.findFirst({
    where: { id: roleId, businessId },
    select: { isSystem: true },
  })
  if (!role) throw notFoundError('Role')
  if (role.isSystem) throw validationError('Cannot delete system roles')
  if (roleId === reassignToId) throw validationError('Cannot reassign to the same role')

  const reassignTo = await prisma.role.findFirst({
    where: { id: reassignToId, businessId },
    select: { id: true },
  })
  if (!reassignTo) throw notFoundError('Reassign role')

  return prisma.$transaction(async (tx) => {
    const result = await tx.businessUser.updateMany({
      where: { businessId, roleId },
      data: { roleId: reassignToId },
    })

    await tx.role.delete({ where: { id: roleId } })

    return { reassignedStaff: result.count }
  })
}

// === Staff ===

export async function listStaff(businessId: string) {
  const [staff, pending] = await Promise.all([
    prisma.businessUser.findMany({
      where: { businessId },
      select: {
        id: true, userId: true, role: true, status: true,
        lastActiveAt: true, joinedAt: true,
        user: { select: { name: true, phone: true } },
        roleRef: { select: { id: true, name: true } },
      },
      orderBy: { joinedAt: 'asc' },
    }),
    prisma.staffInvite.findMany({
      where: { businessId, status: 'PENDING' },
      select: {
        id: true, name: true, phone: true, roleId: true,
        status: true, expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return { staff, pending }
}

export async function inviteStaff(
  businessId: string,
  userId: string,
  data: InviteStaffInput
) {
  // Check if already a member
  const existingUser = await prisma.user.findUnique({
    where: { phone: data.phone },
    select: { id: true },
  })
  if (existingUser) {
    const existingBU = await prisma.businessUser.findUnique({
      where: { userId_businessId: { userId: existingUser.id, businessId } },
      select: { id: true },
    })
    if (existingBU) throw conflictError('User is already a staff member')
  }

  // Generate invite code
  const code = crypto.randomBytes(4).toString('hex').toUpperCase()
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 hours

  const invite = await prisma.staffInvite.create({
    data: {
      businessId,
      name: data.name,
      phone: data.phone,
      roleId: data.roleId,
      code,
      expiresAt,
      invitedBy: userId,
    },
    select: {
      id: true, code: true, expiresAt: true, status: true,
      name: true, phone: true,
    },
  })

  return { invite }
}

export async function updateStaffRole(
  businessId: string,
  staffId: string,
  data: UpdateStaffRoleInput
) {
  const bu = await prisma.businessUser.findFirst({
    where: { id: staffId, businessId },
    select: { id: true, role: true },
  })
  if (!bu) throw notFoundError('Staff member')
  if (bu.role === 'owner') throw validationError('Cannot change owner role')

  return prisma.businessUser.update({
    where: { id: staffId },
    data: { roleId: data.roleId },
    select: {
      id: true, userId: true, role: true, status: true,
      roleRef: { select: { id: true, name: true } },
    },
  })
}

export async function suspendStaff(businessId: string, staffId: string) {
  const bu = await prisma.businessUser.findFirst({
    where: { id: staffId, businessId },
    select: { id: true, role: true },
  })
  if (!bu) throw notFoundError('Staff member')
  if (bu.role === 'owner') throw validationError('Cannot suspend owner')

  return prisma.businessUser.update({
    where: { id: staffId },
    data: { status: 'SUSPENDED', isActive: false },
    select: { id: true, status: true },
  })
}

export async function removeStaff(businessId: string, staffId: string) {
  const bu = await prisma.businessUser.findFirst({
    where: { id: staffId, businessId },
    select: { id: true, role: true },
  })
  if (!bu) throw notFoundError('Staff member')
  if (bu.role === 'owner') throw validationError('Cannot remove owner')

  await prisma.businessUser.delete({ where: { id: staffId } })
}

export async function resendInvite(businessId: string, inviteId: string) {
  const invite = await prisma.staffInvite.findFirst({
    where: { id: inviteId, businessId, status: 'PENDING' },
    select: { id: true, expiresAt: true },
  })
  if (!invite) throw notFoundError('Invite')
  if (invite.expiresAt < new Date()) throw validationError('Invite has expired — create a new one')

  const newExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000)
  const updated = await prisma.staffInvite.update({
    where: { id: inviteId },
    data: { expiresAt: newExpiry },
    select: { id: true, expiresAt: true },
  })

  return { inviteId: updated.id, expiresAt: updated.expiresAt.toISOString() }
}

// === Transaction Lock ===

export async function getTransactionLock(businessId: string) {
  const config = await prisma.transactionLockConfig.findUnique({
    where: { businessId },
    select: {
      lockAfterDays: true, requireApprovalForEdit: true,
      requireApprovalForDelete: true, priceChangeThresholdPercent: true,
      discountThresholdPercent: true,
    },
  })
  return config || {
    lockAfterDays: null,
    requireApprovalForEdit: false,
    requireApprovalForDelete: false,
    priceChangeThresholdPercent: null,
    discountThresholdPercent: null,
    operationPinSet: false,
  }
}

export async function updateTransactionLock(businessId: string, data: UpdateTransactionLockInput) {
  return prisma.transactionLockConfig.upsert({
    where: { businessId },
    create: { businessId, ...data },
    update: data,
    select: {
      lockAfterDays: true, requireApprovalForEdit: true,
      requireApprovalForDelete: true, priceChangeThresholdPercent: true,
      discountThresholdPercent: true,
    },
  })
}

// === Approvals ===

export async function listApprovals(businessId: string, status?: string) {
  const where: Record<string, unknown> = { businessId }
  if (status) where.status = status

  return prisma.approvalRequest.findMany({
    where,
    select: {
      id: true, type: true, entityType: true, entityId: true,
      requestedChanges: true, status: true, reviewedAt: true,
      reviewNote: true, expiresAt: true, createdAt: true,
      requester: { select: { id: true, name: true } },
      reviewer: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
}

export async function reviewApproval(
  businessId: string,
  approvalId: string,
  userId: string,
  data: ReviewApprovalInput
) {
  const approval = await prisma.approvalRequest.findFirst({
    where: { id: approvalId, businessId, status: 'PENDING' },
    select: { id: true, expiresAt: true },
  })
  if (!approval) throw notFoundError('Approval')
  if (approval.expiresAt < new Date()) throw validationError('Approval has expired')

  return prisma.approvalRequest.update({
    where: { id: approvalId },
    data: {
      status: data.action === 'APPROVE' ? 'APPROVED' : 'DENIED',
      reviewedBy: userId,
      reviewedAt: new Date(),
      reviewNote: data.reviewNote || null,
    },
    select: {
      id: true, type: true, status: true,
      reviewedAt: true, reviewNote: true,
    },
  })
}

// === Audit Log ===

export async function listAuditLog(businessId: string, query: AuditLogQuery) {
  const { userId, entityType, action, from, to, page, limit } = query

  const where: Record<string, unknown> = { businessId }
  if (userId) where.userId = userId
  if (entityType) where.entityType = entityType
  if (action) where.action = action
  if (from || to) {
    where.createdAt = {
      ...(from && { gte: new Date(from) }),
      ...(to && { lte: new Date(to) }),
    }
  }

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      select: {
        id: true, action: true, entityType: true, entityId: true,
        entityLabel: true, changes: true, reason: true,
        ipAddress: true, deviceInfo: true, createdAt: true,
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ])

  return {
    entries,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  }
}

/** Create an audit log entry — called from other services */
export async function createAuditEntry(data: {
  businessId: string
  action: string
  entityType: string
  entityId: string
  entityLabel?: string
  userId: string
  changes?: unknown
  reason?: string
  ipAddress?: string
  deviceInfo?: string
}) {
  return prisma.auditLog.create({
    data: {
      businessId: data.businessId,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
      entityLabel: data.entityLabel || null,
      userId: data.userId,
      changes: data.changes as object || null,
      reason: data.reason || null,
      ipAddress: data.ipAddress || null,
      deviceInfo: data.deviceInfo || null,
    },
  })
}

// === App Settings ===

export async function getAppSettings(userId: string) {
  const settings = await prisma.userAppSettings.findUnique({
    where: { userId },
    select: {
      dateFormat: true, pinEnabled: true, biometricEnabled: true,
      calculatorPosition: true, language: true, theme: true,
    },
  })
  return settings || {
    dateFormat: 'DD/MM/YYYY',
    pinEnabled: false,
    biometricEnabled: false,
    calculatorPosition: 'BOTTOM_RIGHT',
    language: 'en',
    theme: 'light',
    operationPinSet: false,
  }
}

export async function updateAppSettings(userId: string, data: UpdateAppSettingsInput) {
  return prisma.userAppSettings.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
    select: {
      dateFormat: true, pinEnabled: true, biometricEnabled: true,
      calculatorPosition: true, language: true, theme: true,
    },
  })
}

// === PIN ===

export async function setPin(userId: string, data: SetPinInput) {
  const existing = await prisma.userAppSettings.findUnique({
    where: { userId },
    select: { pinHash: true },
  })

  // If PIN already set, verify current
  if (existing?.pinHash) {
    if (!data.currentPin) throw validationError('Current PIN is required')
    const valid = await verifyPassword(data.currentPin, existing.pinHash)
    if (!valid) throw unauthorizedError('Current PIN is incorrect')
  }

  const pinHash = await hashPassword(data.newPin)

  return prisma.userAppSettings.upsert({
    where: { userId },
    create: { userId, pinHash, pinEnabled: true },
    update: { pinHash, pinEnabled: true, pinAttempts: 0, pinLockedUntil: null },
    select: { pinEnabled: true },
  })
}

export async function verifyPin(userId: string, data: VerifyPinInput) {
  const settings = await prisma.userAppSettings.findUnique({
    where: { userId },
    select: { pinHash: true, pinAttempts: true, pinLockedUntil: true },
  })
  if (!settings?.pinHash) throw validationError('PIN not set')

  // Check lockout
  if (settings.pinLockedUntil && settings.pinLockedUntil > new Date()) {
    throw validationError('PIN locked. Try again later.')
  }

  const valid = await verifyPassword(data.pin, settings.pinHash)

  if (!valid) {
    const newAttempts = settings.pinAttempts + 1
    const lockout = newAttempts >= 5
      ? new Date(Date.now() + 30 * 60 * 1000)
      : null

    await prisma.userAppSettings.update({
      where: { userId },
      data: { pinAttempts: newAttempts, pinLockedUntil: lockout },
    })

    return { valid: false, attemptsRemaining: Math.max(0, 5 - newAttempts) }
  }

  // Reset attempts on success
  await prisma.userAppSettings.update({
    where: { userId },
    data: { pinAttempts: 0, pinLockedUntil: null },
  })

  return { valid: true, attemptsRemaining: 5 }
}

// === Operation PIN (business-level) ===

export async function setOperationPin(
  businessId: string,
  data: { currentPin?: string; newPin: string }
) {
  const config = await prisma.transactionLockConfig.findUnique({
    where: { businessId },
    select: { operationPinHash: true },
  })

  // If PIN already set, verify current
  if (config?.operationPinHash) {
    if (!data.currentPin) throw validationError('Current operation PIN is required')
    const valid = await verifyPassword(data.currentPin, config.operationPinHash)
    if (!valid) throw unauthorizedError('Current operation PIN is incorrect')
  }

  const pinHash = await hashPassword(data.newPin)

  await prisma.transactionLockConfig.upsert({
    where: { businessId },
    create: { businessId, operationPinHash: pinHash },
    update: { operationPinHash: pinHash },
  })

  return { operationPinSet: true, updatedAt: new Date().toISOString() }
}
