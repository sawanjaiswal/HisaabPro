/**
 * Staff join — accept invite and create a BusinessUser row.
 *
 * Extracted from staff.ts (Phase 6 PR7) to keep the parent file under the
 * 250-line cap after audit-row wiring landed on inviteStaff/removeStaff.
 * No behaviour change vs the original implementation.
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError, validationError, conflictError } from '../../lib/errors.js'

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
