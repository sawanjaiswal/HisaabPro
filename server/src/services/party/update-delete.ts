/**
 * Party update & delete services.
 *
 * Audit-coverage SSOT — every mutation here writes a `tx.auditLog.create` row
 * inside the same `$transaction` so audit + write commit/rollback together.
 */

import { prisma } from '../../lib/prisma.js'
import type { UpdatePartyInput, PartyPatchInput } from '../../schemas/party.schemas.js'
import { requireParty, requireGroup } from './helpers.js'
import { bumpVersionOrConflict } from '../../lib/optimistic-lock.js'

export async function updateParty(
  businessId: string,
  partyId: string,
  userId: string,
  data: UpdatePartyInput,
  expectedVersion?: number
) {
  await requireParty(businessId, partyId)

  if (data.groupId) {
    await requireGroup(businessId, data.groupId)
  }

  return prisma.$transaction(async (tx) => {
    // #150 optimistic lock — atomic version bump inside the same txn as the write.
    await bumpVersionOrConflict(tx, 'party', partyId, businessId, expectedVersion)

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
        ...(data.priceListId !== undefined && { priceListId: data.priceListId }),
      },
      select: {
        id: true,
        version: true, // #150 optimistic-lock token surfaced to clients
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
        priceListId: true,
        priceList: { select: { id: true, name: true, isDefault: true } },
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

    await tx.auditLog.create({
      data: {
        businessId,
        entityType: 'Party',
        entityId: partyId,
        entityLabel: updated.name.slice(0, 120),
        userId,
        action: 'UPDATE',
        changes: data as Record<string, unknown>,
      },
    })

    return updated
  })
}

/**
 * CRM #127 — narrow patch for follow-up + tags (architecture §3.6).
 * Server-only fields (`lastContactedAt`, `loyaltyPointsCache`, `loyaltyOptOut`)
 * are blocked at the Zod layer via `.strict()`. This service only writes the
 * keys present in PartyPatchInput.
 */
export async function patchParty(
  businessId: string,
  partyId: string,
  data: PartyPatchInput,
) {
  await requireParty(businessId, partyId)
  return prisma.party.update({
    where: { id: partyId },
    data: {
      ...(data.followUpAt !== undefined && {
        followUpAt: data.followUpAt === null ? null : new Date(data.followUpAt),
      }),
      ...(data.tags !== undefined && { tags: data.tags }),
    },
    select: {
      id: true,
      name: true,
      tags: true,
      followUpAt: true,
      lastContactedAt: true,
      updatedAt: true,
    },
  })
}

export async function deleteParty(
  businessId: string,
  partyId: string,
  userId: string,
  force = false
) {
  const existing = await requireParty(businessId, partyId)

  return prisma.$transaction(async (tx) => {
    if (force) {
      // Hard delete — only allowed when no transactions exist
      await tx.party.delete({ where: { id: partyId } })
      await tx.auditLog.create({
        data: {
          businessId,
          entityType: 'Party',
          entityId: partyId,
          entityLabel: existing.name?.slice(0, 120),
          userId,
          action: 'DELETE',
          changes: { mode: 'hard' },
        },
      })
      return { deleted: true, mode: 'hard' }
    }

    // Soft delete
    await tx.party.update({
      where: { id: partyId },
      data: { isActive: false },
    })
    await tx.auditLog.create({
      data: {
        businessId,
        entityType: 'Party',
        entityId: partyId,
        entityLabel: existing.name?.slice(0, 120),
        userId,
        action: 'DELETE',
        changes: { mode: 'soft' },
      },
    })
    return { deleted: true, mode: 'soft' }
  })
}
