/**
 * Cascade soft-delete service — handles parent→child relationships.
 *
 * Rules from TRD Section 3.5:
 * - Party: cascade → addresses, pricing, opening balances
 * - Product: cascade → batches, serial numbers
 * - Godown: BLOCK if stock exists
 * - Role: BLOCK if users assigned
 *
 * Financial records (Document, Payment, JournalEntry) are NEVER cascade-deleted.
 * They reference parties/products by snapshot data.
 */

import { AppError, ErrorCode } from '../../lib/errors.js'

// Use a loose type to work with both PrismaClient and extended clients
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaLike = any

const now = () => new Date()

export async function softDeleteParty(
  prisma: PrismaLike,
  partyId: string,
): Promise<void> {
  await prisma.$transaction(async (tx: PrismaLike) => {
    // Cascade children
    await tx.partyAddress.updateMany({
      where: { partyId },
      data: { isDeleted: true, deletedAt: now() },
    })
    await tx.partyPricing.updateMany({
      where: { partyId },
      data: { isDeleted: true, deletedAt: now() },
    })
    await tx.openingBalance.updateMany({
      where: { partyId },
      data: { isDeleted: true, deletedAt: now() },
    })
    // Soft-delete the party itself
    await tx.party.update({
      where: { id: partyId },
      data: { isDeleted: true, deletedAt: now() },
    })
  })
}

export async function softDeleteProduct(
  prisma: PrismaLike,
  productId: string,
): Promise<void> {
  await prisma.$transaction(async (tx: PrismaLike) => {
    // Cascade children
    await tx.batch.updateMany({
      where: { productId },
      data: { isDeleted: true, deletedAt: now() },
    })
    await tx.serialNumber.updateMany({
      where: { productId },
      data: { isDeleted: true, deletedAt: now() },
    })
    // Soft-delete the product itself
    await tx.product.update({
      where: { id: productId },
      data: { isDeleted: true, deletedAt: now() },
    })
  })
}

export async function softDeleteGodown(
  prisma: PrismaLike,
  godownId: string,
): Promise<void> {
  // BLOCK: cannot delete godown with stock
  const stockCount = await prisma.godownStock.count({
    where: { godownId, quantity: { gt: 0 } },
  })
  if (stockCount > 0) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      400,
      'Transfer all stock before deleting godown',
      { godownId, stockCount },
    )
  }
  await prisma.godown.update({
    where: { id: godownId },
    data: { isDeleted: true, deletedAt: now() },
  })
}

export async function softDeleteRole(
  prisma: PrismaLike,
  roleId: string,
): Promise<void> {
  // BLOCK: cannot delete role with assigned users
  const userCount = await prisma.businessUser.count({
    where: { roleId },
  })
  if (userCount > 0) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      400,
      'Reassign all users before deleting role',
      { roleId, userCount },
    )
  }
  await prisma.role.update({
    where: { id: roleId },
    data: { isDeleted: true, deletedAt: now() },
  })
}

/** Restore a party and all its cascade children */
export async function restoreParty(
  prisma: PrismaLike,
  partyId: string,
): Promise<void> {
  await prisma.$transaction(async (tx: PrismaLike) => {
    await tx.party.update({
      where: { id: partyId },
      data: { isDeleted: false, deletedAt: null },
    })
    await tx.partyAddress.updateMany({
      where: { partyId, isDeleted: true },
      data: { isDeleted: false, deletedAt: null },
    })
    await tx.partyPricing.updateMany({
      where: { partyId, isDeleted: true },
      data: { isDeleted: false, deletedAt: null },
    })
    await tx.openingBalance.updateMany({
      where: { partyId, isDeleted: true },
      data: { isDeleted: false, deletedAt: null },
    })
  })
}

/** Restore a product and all its cascade children */
export async function restoreProduct(
  prisma: PrismaLike,
  productId: string,
): Promise<void> {
  await prisma.$transaction(async (tx: PrismaLike) => {
    await tx.product.update({
      where: { id: productId },
      data: { isDeleted: false, deletedAt: null },
    })
    await tx.batch.updateMany({
      where: { productId, isDeleted: true },
      data: { isDeleted: false, deletedAt: null },
    })
    await tx.serialNumber.updateMany({
      where: { productId, isDeleted: true },
      data: { isDeleted: false, deletedAt: null },
    })
  })
}
