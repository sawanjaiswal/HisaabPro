/**
 * POS Void & Restore Service
 *
 * voidPosSale   — reverse stock, void cash entry, mark Document VOIDED.
 * restorePosSale — undo void within window, re-apply stock + cash.
 *
 * Both run inside a Serializable Prisma $transaction.
 */

import type { ExtendedPrismaClient } from '../../lib/prisma.js'
import { AppError, ErrorCode, notFoundError } from '../../lib/errors.js'
import type { PosServiceCtx } from './pos.types.js'
import { DEFAULT_VOID_WINDOW_HOURS, POS_STOCK_REFERENCE_TYPE } from './pos.constants.js'
import { isCashRegisterEnabled } from './pos-checkout.cash.js'
import logger from '../../lib/logger.js'

const DEFAULT_RESTORE_WINDOW_HOURS = 4

// ─── Error factories ─────────────────────────────────────────────────────────

const alreadyVoidedError = () =>
  new AppError(ErrorCode.DUPLICATE_ENTRY, 409, 'POS sale is already voided', { posCode: 'ALREADY_VOIDED' })

const notVoidedError = () =>
  new AppError(ErrorCode.VALIDATION_ERROR, 409, 'POS sale is not voided; cannot restore', { posCode: 'NOT_VOIDED' })

const voidWindowExpiredError = (h: number) =>
  new AppError(ErrorCode.VALIDATION_ERROR, 410, `Void window of ${h}h has expired`, { posCode: 'VOID_WINDOW_EXPIRED', windowHours: h })

const restoreWindowExpiredError = (h: number) =>
  new AppError(ErrorCode.VALIDATION_ERROR, 410, `Restore window of ${h}h has expired`, { posCode: 'RESTORE_WINDOW_EXPIRED', windowHours: h })

// ─── Types ───────────────────────────────────────────────────────────────────

type TxClient = Parameters<Parameters<ExtendedPrismaClient['$transaction']>[0]>[0]

export interface VoidResult   { id: string; status: 'VOIDED'; voidedAt: Date; voidReason: string }
export interface RestoreResult { id: string; status: 'ACTIVE'; restoredAt: Date }

// ─── Stock helpers ────────────────────────────────────────────────────────────

async function reverseStock(tx: TxClient, businessId: string, userId: string, posSaleId: string, receiptNumber: string): Promise<void> {
  const items = await tx.posSaleItem.findMany({
    where: { posSaleId },
    select: { productId: true, quantity: true, batchId: true },
  })
  for (const item of items) {
    await tx.product.update({ where: { id: item.productId }, data: { currentStock: { increment: item.quantity } } })
    if (item.batchId) {
      await tx.batch.update({ where: { id: item.batchId }, data: { currentStock: { increment: item.quantity } } })
    }
    await tx.stockMovement.create({
      data: {
        businessId, productId: item.productId, type: 'SALE_REVERSAL',
        quantity: item.quantity, balanceAfter: 0,
        referenceType: POS_STOCK_REFERENCE_TYPE, referenceId: posSaleId,
        referenceNumber: receiptNumber, createdBy: userId, batchId: item.batchId ?? null,
      },
    })
  }
  logger.debug('POS stock reversed', { posSaleId, itemCount: items.length })
}

async function reapplyStock(tx: TxClient, businessId: string, userId: string, posSaleId: string, receiptNumber: string): Promise<void> {
  const items = await tx.posSaleItem.findMany({
    where: { posSaleId },
    select: { productId: true, quantity: true, batchId: true },
  })
  for (const item of items) {
    await tx.product.update({ where: { id: item.productId }, data: { currentStock: { decrement: item.quantity } } })
    if (item.batchId) {
      await tx.batch.update({ where: { id: item.batchId }, data: { currentStock: { decrement: item.quantity } } })
    }
    await tx.stockMovement.create({
      data: {
        businessId, productId: item.productId, type: 'SALE',
        quantity: -item.quantity, balanceAfter: 0,
        referenceType: POS_STOCK_REFERENCE_TYPE, referenceId: posSaleId,
        referenceNumber: receiptNumber, createdBy: userId, batchId: item.batchId ?? null,
      },
    })
  }
  logger.debug('POS stock re-applied', { posSaleId, itemCount: items.length })
}

// ─── Cash helpers ─────────────────────────────────────────────────────────────

async function resolveBuId(tx: TxClient, userId: string, businessId: string): Promise<string> {
  const bu = await tx.businessUser.findFirst({ where: { userId, businessId }, select: { id: true } })
  return bu?.id ?? userId
}

async function voidCashEntry(tx: TxClient, businessId: string, userId: string, idempotencyKey: string): Promise<void> {
  if (!isCashRegisterEnabled()) return
  const entry = await tx.cashEntry.findFirst({
    where: { businessId, idempotencyKey: `pos:${idempotencyKey}`, voidedAt: null },
    select: { id: true },
  })
  if (!entry) return
  const buId = await resolveBuId(tx, userId, businessId)
  await tx.cashEntry.update({ where: { id: entry.id }, data: { voidedAt: new Date(), voidedBy: buId, voidReason: 'POS sale voided' } })
  await tx.cashEntryEvent.create({ data: { cashEntryId: entry.id, eventType: 'VOIDED', actorId: buId, reason: 'POS sale voided', changes: { source: 'pos_void' } } })
}

async function restoreCashEntry(tx: TxClient, businessId: string, userId: string, idempotencyKey: string): Promise<void> {
  if (!isCashRegisterEnabled()) return
  const entry = await tx.cashEntry.findFirst({
    where: { businessId, idempotencyKey: `pos:${idempotencyKey}`, voidedAt: { not: null } },
    select: { id: true },
  })
  if (!entry) return
  const buId = await resolveBuId(tx, userId, businessId)
  await tx.cashEntry.update({ where: { id: entry.id }, data: { voidedAt: null, voidedBy: null, voidReason: null } })
  await tx.cashEntryEvent.create({ data: { cashEntryId: entry.id, eventType: 'RESTORED', actorId: buId, changes: { source: 'pos_restore' } } })
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function voidPosSale(
  prisma: ExtendedPrismaClient,
  ctx: PosServiceCtx,
  posSaleId: string,
  reason: string
): Promise<VoidResult> {
  return prisma.$transaction(async (tx) => {
    const sale = await tx.posSale.findFirst({
      where: { id: posSaleId, businessId: ctx.businessId },
      select: { id: true, status: true, createdAt: true, documentId: true, receiptNumber: true, idempotencyKey: true },
    })
    if (!sale) throw notFoundError('PosSale', { posSaleId })
    if (sale.status !== 'ACTIVE') throw alreadyVoidedError()

    const setting = await tx.posSetting.findUnique({ where: { businessId: ctx.businessId }, select: { voidWindowHours: true } })
    const windowHours = setting?.voidWindowHours ?? DEFAULT_VOID_WINDOW_HOURS
    const now = new Date()

    // Window check: sale must be within voidWindowHours since creation
    if (now.getTime() - sale.createdAt.getTime() > windowHours * 3600 * 1000) {
      throw voidWindowExpiredError(windowHours)
    }

    await reverseStock(tx, ctx.businessId, ctx.userId, posSaleId, sale.receiptNumber)
    await voidCashEntry(tx, ctx.businessId, ctx.userId, sale.idempotencyKey)

    await tx.document.update({ where: { id: sale.documentId }, data: { status: 'VOIDED' } })
    const voidedAt = now
    await tx.posSale.update({
      where: { id: posSaleId },
      data: { status: 'VOIDED', voidedAt, voidedBy: ctx.userId, voidReason: reason },
    })
    await tx.posSaleEvent.create({
      data: { posSaleId, type: 'VOIDED', actorId: ctx.userId, payload: { reason, voidedBy: ctx.userId } as object },
    })

    logger.info('POS sale voided', { posSaleId, businessId: ctx.businessId, reason })
    return { id: posSaleId, status: 'VOIDED' as const, voidedAt, voidReason: reason }
  }, { isolationLevel: 'Serializable' })
}

export async function restorePosSale(
  prisma: ExtendedPrismaClient,
  ctx: PosServiceCtx,
  posSaleId: string
): Promise<RestoreResult> {
  return prisma.$transaction(async (tx) => {
    const sale = await tx.posSale.findFirst({
      where: { id: posSaleId, businessId: ctx.businessId },
      select: { id: true, status: true, voidedAt: true, documentId: true, receiptNumber: true, idempotencyKey: true },
    })
    if (!sale) throw notFoundError('PosSale', { posSaleId })
    if (sale.status !== 'VOIDED' || !sale.voidedAt) throw notVoidedError()

    const now = new Date()

    // Window check: restore must happen within DEFAULT_RESTORE_WINDOW_HOURS of void
    if (now.getTime() - sale.voidedAt.getTime() > DEFAULT_RESTORE_WINDOW_HOURS * 3600 * 1000) {
      throw restoreWindowExpiredError(DEFAULT_RESTORE_WINDOW_HOURS)
    }

    await reapplyStock(tx, ctx.businessId, ctx.userId, posSaleId, sale.receiptNumber)
    await restoreCashEntry(tx, ctx.businessId, ctx.userId, sale.idempotencyKey)

    await tx.document.update({ where: { id: sale.documentId }, data: { status: 'SAVED' } })
    const restoredAt = now
    await tx.posSale.update({
      where: { id: posSaleId },
      data: { status: 'ACTIVE', voidedAt: null, voidedBy: null, voidReason: null, restoredAt, restoredBy: ctx.userId },
    })
    await tx.posSaleEvent.create({
      data: { posSaleId, type: 'RESTORED', actorId: ctx.userId, payload: { restoredBy: ctx.userId } as object },
    })

    logger.info('POS sale restored', { posSaleId, businessId: ctx.businessId })
    return { id: posSaleId, status: 'ACTIVE' as const, restoredAt }
  }, { isolationLevel: 'Serializable' })
}
