/** Staff — invite, join, suspend, remove, update role */
import crypto from 'crypto'
import { prisma } from '../../lib/prisma.js'
import { notFoundError, validationError, conflictError } from '../../lib/errors.js'
import { blacklistUser } from '../../lib/token-blacklist.js'
import { INVITE_CODE_BYTES, INVITE_TTL_MS, MAX_PENDING_INVITES } from '../../config/security.js'
import type { InviteStaffInput, UpdateStaffRoleInput } from '../../schemas/settings.schemas.js'

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
      take: 100,
    }),
    prisma.staffInvite.findMany({
      where: { businessId, status: 'PENDING' },
      select: {
        id: true, name: true, phone: true, roleId: true,
        status: true, expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
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

/** Accept a staff invite and join a business. */
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

/** Cancel a pending staff invite. */
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
