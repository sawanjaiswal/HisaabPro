/**
 * Party address services.
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError, validationError } from '../../lib/errors.js'
import type { CreateAddressInput, UpdateAddressInput } from '../../schemas/party.schemas.js'
import { requireParty } from './helpers.js'

export async function createAddress(
  businessId: string,
  partyId: string,
  data: CreateAddressInput
) {
  await requireParty(businessId, partyId)

  return prisma.$transaction(async (tx) => {
    // If this is the new default, unset existing defaults of same type
    if (data.isDefault) {
      await tx.partyAddress.updateMany({
        where: { partyId, type: data.type, isDefault: true },
        data: { isDefault: false },
      })
    }

    return tx.partyAddress.create({
      data: {
        partyId,
        label: data.label ?? 'Default',
        line1: data.line1,
        line2: data.line2,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        type: data.type,
        isDefault: data.isDefault,
      },
      select: {
        id: true,
        partyId: true,
        label: true,
        line1: true,
        line2: true,
        city: true,
        state: true,
        pincode: true,
        type: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  })
}

export async function updateAddress(
  businessId: string,
  partyId: string,
  addressId: string,
  data: UpdateAddressInput
) {
  await requireParty(businessId, partyId)

  const address = await prisma.partyAddress.findFirst({
    where: { id: addressId, partyId },
  })
  if (!address) throw notFoundError('Address')

  return prisma.$transaction(async (tx) => {
    // If setting as default, unset other defaults of same type
    const targetType = data.type ?? address.type
    if (data.isDefault) {
      await tx.partyAddress.updateMany({
        where: { partyId, type: targetType, isDefault: true, id: { not: addressId } },
        data: { isDefault: false },
      })
    }

    return tx.partyAddress.update({
      where: { id: addressId },
      data: {
        ...(data.label !== undefined && { label: data.label }),
        ...(data.line1 !== undefined && { line1: data.line1 }),
        ...(data.line2 !== undefined && { line2: data.line2 }),
        ...(data.city !== undefined && { city: data.city }),
        ...(data.state !== undefined && { state: data.state }),
        ...(data.pincode !== undefined && { pincode: data.pincode }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
      },
      select: {
        id: true,
        partyId: true,
        label: true,
        line1: true,
        line2: true,
        city: true,
        state: true,
        pincode: true,
        type: true,
        isDefault: true,
        updatedAt: true,
      },
    })
  })
}

export async function deleteAddress(
  businessId: string,
  partyId: string,
  addressId: string
) {
  await requireParty(businessId, partyId)

  const address = await prisma.partyAddress.findFirst({
    where: { id: addressId, partyId },
  })
  if (!address) throw notFoundError('Address')

  // Prevent deleting the last billing address
  if (address.type === 'BILLING') {
    const billingCount = await prisma.partyAddress.count({
      where: { partyId, type: 'BILLING' },
    })
    if (billingCount <= 1) {
      throw validationError('Cannot delete the last billing address')
    }
  }

  await prisma.partyAddress.update({
    where: { id: addressId },
    data: { isDeleted: true, deletedAt: new Date() },
  })
  return { deleted: true }
}
