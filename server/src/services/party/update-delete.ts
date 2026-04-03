/**
 * Party update & delete services.
 */

import { prisma } from '../../lib/prisma.js'
import type { UpdatePartyInput } from '../../schemas/party.schemas.js'
import { requireParty, requireGroup } from './helpers.js'

export async function updateParty(
  businessId: string,
  partyId: string,
  data: UpdatePartyInput
) {
  await requireParty(businessId, partyId)

  if (data.groupId) {
    await requireGroup(businessId, data.groupId)
  }

  return prisma.$transaction(async (tx) => {
    // Update core party
    const updated = await tx.party.update({
      where: { id: partyId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.companyName !== undefined && { companyName: data.companyName }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.groupId !== undefined && { groupId: data.groupId }),
        ...(data.tags !== undefined && { tags: data.tags }),
        ...(data.gstin !== undefined && { gstin: data.gstin }),
        ...(data.pan !== undefined && { pan: data.pan }),
        ...(data.creditLimit !== undefined && { creditLimit: data.creditLimit }),
        ...(data.creditLimitMode !== undefined && { creditLimitMode: data.creditLimitMode }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        companyName: true,
        type: true,
        groupId: true,
        tags: true,
        gstin: true,
        pan: true,
        creditLimit: true,
        creditLimitMode: true,
        outstandingBalance: true,
        totalBusiness: true,
        notes: true,
        isActive: true,
        updatedAt: true,
      },
    })

    // Batch upsert custom field values if provided
    if (data.customFields && data.customFields.length > 0) {
      await Promise.all(data.customFields.map(cf =>
        tx.partyCustomFieldValue.upsert({
          where: { partyId_fieldId: { partyId, fieldId: cf.fieldId } },
          create: { partyId, fieldId: cf.fieldId, value: cf.value },
          update: { value: cf.value },
        })
      ))
    }

    return updated
  })
}

export async function deleteParty(
  businessId: string,
  partyId: string,
  force = false
) {
  await requireParty(businessId, partyId)

  if (force) {
    // Hard delete — only allowed when no transactions exist
    await prisma.party.delete({ where: { id: partyId } })
    return { deleted: true, mode: 'hard' }
  }

  // Soft delete
  await prisma.party.update({
    where: { id: partyId },
    data: { isActive: false },
  })
  return { deleted: true, mode: 'soft' }
}
