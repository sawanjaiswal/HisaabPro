/**
 * Transaction Lock — get/update lock config
 */

import { prisma } from '../../lib/prisma.js'
import type { UpdateTransactionLockInput } from '../../schemas/settings.schemas.js'

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

export async function updateTransactionLock(
  businessId: string,
  userId: string,
  data: UpdateTransactionLockInput,
) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.transactionLockConfig.upsert({
      where: { businessId },
      create: { businessId, ...data },
      update: data,
      select: {
        lockAfterDays: true, requireApprovalForEdit: true,
        requireApprovalForDelete: true, priceChangeThresholdPercent: true,
        discountThresholdPercent: true,
      },
    })

    await tx.auditLog.create({
      data: {
        businessId,
        entityType: 'TransactionLock',
        entityId: businessId,
        entityLabel: null,
        userId,
        action: 'UPDATE',
        changes: data as Record<string, unknown>,
      },
    })

    return updated
  })
}
