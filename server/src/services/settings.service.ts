/**
 * Settings Service — Roles, Staff, Transaction Lock, Approvals, Audit, App Settings, PIN
 */

import crypto from 'crypto'
import { prisma } from '../lib/prisma.js'
import { notFoundError, validationError, conflictError, unauthorizedError } from '../lib/errors.js'
import { hashPassword, verifyPassword } from '../lib/password.js'
import { blacklistUser } from '../lib/token-blacklist.js'
import { INVITE_CODE_BYTES, INVITE_TTL_MS, MAX_PENDING_INVITES } from '../config/security.js'
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
    key: 'accounting', label: 'Accounting',
    actions: [
      { key: 'view', label: 'View Accounting' },
      { key: 'create', label: 'Create Entries' },
      { key: 'edit', label: 'Edit Entries' },
      { key: 'delete', label: 'Delete Entries' },
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

const ALL_PERMISSIONS = PERMISSION_MATRIX.flatMap(m =>
  m.actions.map(a => `${m.key}.${a.key}`)
)

const SYSTEM_ROLES: Array<{
  name: string; isSystem: boolean; priority: number
  permissions: string[]; isDefault?: boolean
}> = [
  {
    name: 'Owner',
    isSystem: true,
    priority: 100,
    permissions: ALL_PERMISSIONS,
  },
  {
    name: 'Partner',
    isSystem: true,
    priority: 90,
    permissions: ALL_PERMISSIONS.filter(p => p !== 'settings.manageStaff'),
  },
  {
    name: 'Manager',
    isSystem: true,
    priority: 70,
    permissions: ALL_PERMISSIONS.filter(p =>
      !['settings.manageStaff', 'settings.modify'].includes(p)
    ),
  },
  {
    name: 'Salesman',
    isSystem: true,
    priority: 50,
    permissions: [
      'invoicing.view', 'invoicing.create', 'invoicing.edit', 'invoicing.share',
      'parties.view',
      'payments.view', 'payments.record',
      'reports.view',
      'fields.viewPartyPhone',
    ],
  },
  {
    name: 'Cashier',
    isSystem: true,
    priority: 40,
    permissions: [
      'payments.view', 'payments.record',
      'parties.view',
      'invoicing.view',
      'fields.viewPartyPhone', 'fields.viewPartyOutstanding',
    ],
  },
  {
    name: 'Stock Manager',
    isSystem: true,
    priority: 50,
    permissions: [
      'inventory.view', 'inventory.create', 'inventory.edit', 'inventory.adjustStock',
      'invoicing.view',
      'parties.view',
      'reports.view',
      'fields.viewPurchasePrice',
    ],
  },
  {
    name: 'Delivery Boy',
    isSystem: true,
    priority: 30,
    permissions: [
      'invoicing.view', 'invoicing.share',
      'parties.view',
      'payments.view', 'payments.record',
      'fields.viewPartyPhone',
    ],
  },
  {
    name: 'Accountant',
    isSystem: true,
    isDefault: true,
    priority: 60,
    permissions: [
      'invoicing.view',
      'inventory.view',
      'payments.view',
      'parties.view',
      'reports.view', 'reports.download',
      'accounting.view', 'accounting.create', 'accounting.edit',
      'fields.viewPurchasePrice', 'fields.viewProfitMargin',
      'fields.viewPartyOutstanding',
    ],
  },
]

export async function ensureSystemRoles(businessId: string) {
  const existing = await prisma.role.count({ where: { businessId, isSystem: true } })
  if (existing >= SYSTEM_ROLES.length) return

  for (const role of SYSTEM_ROLES) {
    await prisma.role.upsert({
      where: { businessId_name: { businessId, name: role.name } },
      create: {
        businessId,
        name: role.name,
        isSystem: true,
        isDefault: role.isDefault ?? false,
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
    take: 100,
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

const VALID_PERMISSIONS = new Set(ALL_PERMISSIONS)

export async function createRole(businessId: string, data: CreateRoleInput) {
  // Validate permission strings against known matrix
  const invalid = data.permissions.filter(p => !VALID_PERMISSIONS.has(p))
  if (invalid.length > 0) {
    throw validationError(`Invalid permissions: ${invalid.join(', ')}`)
  }

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

  if (data.permissions) {
    const invalid = data.permissions.filter(p => !VALID_PERMISSIONS.has(p))
    if (invalid.length > 0) {
      throw validationError(`Invalid permissions: ${invalid.join(', ')}`)
    }
  }

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
      take: 100, // bounded: typically < 100 staff per business
    }),
    prisma.staffInvite.findMany({
      where: { businessId, status: 'PENDING' },
      select: {
        id: true, name: true, phone: true, roleId: true,
        status: true, expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // bounded: typically < 100 pending invites per business
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

  // Check max pending invites
  const pendingCount = await prisma.staffInvite.count({
    where: { businessId, status: 'PENDING' },
  })
  if (pendingCount >= MAX_PENDING_INVITES) {
    throw validationError(`Maximum ${MAX_PENDING_INVITES} pending invites reached`)
  }

  // Validate roleId exists in this business
  if (data.roleId) {
    const role = await prisma.role.findFirst({
      where: { id: data.roleId, businessId },
      select: { id: true },
    })
    if (!role) throw notFoundError('Role')
  }

  // Generate invite code (6 hex chars from 3 bytes)
  const code = crypto.randomBytes(INVITE_CODE_BYTES).toString('hex').toUpperCase()
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS)

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

/**
 * Accept a staff invite and join a business.
 * Validates: code exists, not expired, phone matches, not already member.
 */
export async function joinBusiness(userId: string, phone: string, code: string) {
  const invite = await prisma.staffInvite.findUnique({
    where: { code },
    select: {
      id: true, businessId: true, phone: true, roleId: true,
      status: true, expiresAt: true, name: true,
      business: { select: { id: true, name: true, businessType: true } },
    },
  })

  if (!invite) throw notFoundError('Invite code')
  if (invite.status !== 'PENDING') throw validationError('This invite has already been used')
  if (invite.expiresAt < new Date()) {
    throw validationError('This invite has expired. Ask the business owner to send a new one.')
  }
  if (invite.phone !== phone) {
    throw validationError('This invite was sent to a different phone number')
  }

  // Entire acceptance inside a single transaction to prevent race conditions
  const businessUser = await prisma.$transaction(async (tx) => {
    // Re-check status inside transaction (prevents concurrent acceptance)
    const freshInvite = await tx.staffInvite.update({
      where: { id: invite.id, status: 'PENDING' },
      data: { status: 'ACCEPTED' },
      select: { id: true },
    }).catch(() => null)

    if (!freshInvite) throw validationError('This invite has already been used')

    // Check not already a member (inside transaction)
    const existing = await tx.businessUser.findUnique({
      where: { userId_businessId: { userId, businessId: invite.businessId } },
      select: { id: true },
    })
    if (existing) throw conflictError('You are already a member of this business')

    // Validate roleId exists if provided
    if (invite.roleId) {
      const role = await tx.role.findFirst({
        where: { id: invite.roleId, businessId: invite.businessId },
        select: { id: true },
      })
      if (!role) throw validationError('The assigned role no longer exists')
    }

    return tx.businessUser.create({
      data: {
        userId,
        businessId: invite.businessId,
        role: 'staff',
        roleId: invite.roleId,
        status: 'ACTIVE',
        isActive: true,
      },
      select: {
        id: true, role: true, status: true,
        roleRef: { select: { id: true, name: true } },
      },
    })
  })

  return { businessUser, business: invite.business }
}

/**
 * Cancel a pending staff invite.
 */
export async function cancelInvite(businessId: string, inviteId: string) {
  const invite = await prisma.staffInvite.findFirst({
    where: { id: inviteId, businessId, status: 'PENDING' },
    select: { id: true },
  })
  if (!invite) throw notFoundError('Invite')

  await prisma.staffInvite.update({
    where: { id: inviteId },
    data: { status: 'CANCELLED' },
  })

  return { message: 'Invite cancelled' }
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
    select: { id: true, role: true, userId: true },
  })
  if (!bu) throw notFoundError('Staff member')
  if (bu.role === 'owner') throw validationError('Cannot suspend owner')

  // Immediately blacklist user's tokens so they can't continue
  blacklistUser(bu.userId)

  return prisma.businessUser.update({
    where: { id: staffId },
    data: { status: 'SUSPENDED', isActive: false },
    select: { id: true, status: true },
  })
}

export async function removeStaff(businessId: string, staffId: string) {
  const bu = await prisma.businessUser.findFirst({
    where: { id: staffId, businessId },
    select: { id: true, role: true, userId: true },
  })
  if (!bu) throw notFoundError('Staff member')
  if (bu.role === 'owner') throw validationError('Cannot remove owner')

  // Immediately blacklist user's tokens
  blacklistUser(bu.userId)

  await prisma.businessUser.delete({ where: { id: staffId } })
}

export async function resendInvite(businessId: string, inviteId: string) {
  const invite = await prisma.staffInvite.findFirst({
    where: { id: inviteId, businessId, status: 'PENDING' },
    select: { id: true },
  })
  if (!invite) throw notFoundError('Invite')

  // Generate new code + reset expiry (even if expired)
  const newCode = crypto.randomBytes(INVITE_CODE_BYTES).toString('hex').toUpperCase()
  const newExpiry = new Date(Date.now() + INVITE_TTL_MS)
  const updated = await prisma.staffInvite.update({
    where: { id: inviteId },
    data: { code: newCode, expiresAt: newExpiry },
    select: { id: true, code: true, expiresAt: true },
  })

  return { invite: updated }
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

export async function listApprovals(
  businessId: string,
  status?: string,
  page = 1,
  limit = 50,
) {
  const where: Record<string, unknown> = { businessId }
  if (status) where.status = status

  const safePage = Math.max(1, page)
  const safeLimit = Math.min(Math.max(1, limit), 200)

  const [entries, total] = await Promise.all([
    prisma.approvalRequest.findMany({
      where,
      select: {
        id: true, type: true, entityType: true, entityId: true,
        requestedChanges: true, status: true, reviewedAt: true,
        reviewNote: true, expiresAt: true, createdAt: true,
        requester: { select: { id: true, name: true } },
        reviewer: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    }),
    prisma.approvalRequest.count({ where }),
  ])

  return {
    entries,
    pagination: { page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) },
  }
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
