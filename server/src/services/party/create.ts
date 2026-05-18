/**
 * Party creation service.
 */

import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import type { CreatePartyInput } from '../../schemas/party.schemas.js'
import { requireGroup } from './helpers.js'
import { AppError, ErrorCode } from '../../lib/errors.js'
// SSE events auto-emitted by middleware/sse-emit.ts on successful responses

export async function createParty(businessId: string, data: CreatePartyInput) {
  logger.info('Creating party', { businessId, partyName: data.name })

  // M7 closure (Phase 6 v2.2) — STAFF parties are server-created ONLY via the
  // Employee pairing tx in services/hr/employee.service.ts. Reject any attempt
  // to mint one through the public POST /api/parties surface. See
  // ARCHITECTURE_PHASE6_STAFF_HR §8.5 (Employee↔Party STAFF pairing).
  if (data.type === 'STAFF') {
    throw new AppError(
      ErrorCode.INVALID_PARTY_TYPE,
      400,
      'STAFF parties cannot be created via this endpoint — use the Employee flow.',
      { reason: 'Created via Employee flow only' },
    )
  }

  // Validate groupId belongs to business if provided
  if (data.groupId) {
    await requireGroup(businessId, data.groupId)
  }

  // Determine initial outstanding balance from opening balance
  const openingAmount = data.openingBalance
    ? data.openingBalance.type === 'RECEIVABLE'
      ? data.openingBalance.amount
      : -data.openingBalance.amount
    : 0

  const party = await prisma.$transaction(async (tx) => {
    const created = await tx.party.create({
      data: {
        businessId,
        name: data.name,
        phone: data.phone,
        email: data.email,
        companyName: data.companyName,
        type: data.type,
        groupId: data.groupId,
        tags: data.tags,
        gstin: data.gstin,
        pan: data.pan,
        creditLimit: data.creditLimit,
        creditLimitMode: data.creditLimitMode,
        notes: data.notes,
        outstandingBalance: openingAmount,
        ...(data.priceListId !== undefined && { priceListId: data.priceListId }),
      },
      select: {
        id: true,
        businessId: true,
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
        createdAt: true,
        updatedAt: true,
        priceListId: true,
        priceList: { select: { id: true, name: true, isDefault: true } },
      },
    })

    // Create addresses
    if (data.addresses.length > 0) {
      await tx.partyAddress.createMany({
        data: data.addresses.map((addr) => ({
          partyId: created.id,
          label: addr.label ?? 'Default',
          line1: addr.line1,
          line2: addr.line2,
          city: addr.city,
          state: addr.state,
          pincode: addr.pincode,
          type: addr.type,
          isDefault: addr.isDefault,
        })),
      })
    }

    // Create custom field values
    if (data.customFields.length > 0) {
      await tx.partyCustomFieldValue.createMany({
        data: data.customFields.map((cf) => ({
          partyId: created.id,
          fieldId: cf.fieldId,
          value: cf.value,
        })),
      })
    }

    // Create opening balance
    if (data.openingBalance) {
      await tx.openingBalance.create({
        data: {
          partyId: created.id,
          amount: data.openingBalance.amount,
          type: data.openingBalance.type,
          asOfDate: new Date(data.openingBalance.asOfDate),
          notes: data.openingBalance.notes,
        },
      })
    }

    return created
  })

  return party
}
