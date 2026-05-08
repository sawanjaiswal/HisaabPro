/**
 * Production Run — atomic execute.
 * Single Prisma $transaction, Read Committed, SELECT...FOR UPDATE (sorted productIds).
 * Idempotency persisted inside the transaction.
 */

import { prisma } from '../../lib/prisma.js'
import { Prisma } from '@prisma/client'
import { computeWeightedAvg } from '../stock/invoice-ops-purchase.js'
import { checkProductionRunReplay, storeProductionRunIdempotency } from './production-run.idempotency.js'
import { loadRunDetail, type RunPrismaClient } from './production-run.service.js'
import { checkAndCreateAlerts } from '../stock-alert.service.js'
import type { ProductionRunDetailDTO, ShortfallDetail } from './production-run.types.js'
import logger from '../../lib/logger.js'

type ValidationMode = 'WARN_ONLY' | 'HARD_BLOCK'

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

export async function executeProductionRun(args: {
  businessId: string
  bomId: string
  quantityProduced: number
  runDate: Date
  notes?: string
  userId: string
  idempotencyKey: string
}): Promise<ProductionRunDetailDTO> {
  const { businessId, bomId, quantityProduced, runDate, notes, userId, idempotencyKey } = args

  // (a) pre-tx idempotency check
  const replay = await checkProductionRunReplay(prisma, businessId, idempotencyKey)
  if (replay.hit) return replay.response

  // (b) fail-fast precheck outside tx
  const bom = await prisma.bom.findFirst({
    where: { id: bomId, businessId, isDeleted: false },
    select: {
      id: true,
      productId: true,
      isActive: true,
      components: { select: { componentProductId: true, quantity: true } },
    },
  })
  if (!bom) throw { code: 'BOM_NOT_FOUND', message: 'BOM not found', status: 404 }
  if (!bom.isActive) throw { code: 'BOM_NOT_ACTIVE', message: 'This recipe is no longer active', status: 400 }
  if (bom.components.length === 0) throw { code: 'VALIDATION_ERROR', message: 'BOM has no components', status: 400 }

  for (const c of bom.components) {
    const req = c.quantity * quantityProduced
    if (!Number.isFinite(req) || req > Number.MAX_SAFE_INTEGER) {
      throw { code: 'OVERFLOW', message: 'Required quantity overflows safe integer range', status: 400 }
    }
  }

  // (c) atomic transaction
  const result = await prisma.$transaction(async (tx) => {
    // c1. lock all Product rows in stable sorted order (deadlock-free)
    const productIds = [bom.productId, ...bom.components.map(c => c.componentProductId)].sort()
    await tx.$queryRawUnsafe<unknown[]>(
      `SELECT id FROM "Product" WHERE id = ANY($1::text[]) ORDER BY id FOR UPDATE`,
      productIds
    )

    // c2. inventory setting
    const setting = await tx.inventorySetting.findUnique({
      where: { businessId },
      select: { stockValidationMode: true },
    })
    const businessMode = (setting?.stockValidationMode as ValidationMode) ?? 'WARN_ONLY'

    // c3. fetch locked product snapshots
    const products = await tx.product.findMany({
      where: { id: { in: productIds }, businessId },
      select: { id: true, name: true, currentStock: true, weightedAvgCostPaise: true, stockValidation: true },
    })
    const byId = new Map(products.map(p => [p.id, p]))

    // c4. stock check — collect HARD_BLOCK failures and WARN_ONLY warnings
    const warnings: string[] = []
    const insufficient: ShortfallDetail[] = []
    for (const c of bom.components) {
      const p = byId.get(c.componentProductId)!
      const required = round3(c.quantity * quantityProduced)
      const effectiveMode: ValidationMode =
        p.stockValidation === 'GLOBAL' ? businessMode : (p.stockValidation as ValidationMode)
      if (p.currentStock < required) {
        if (effectiveMode === 'HARD_BLOCK') {
          insufficient.push({ productId: p.id, productName: p.name, required, available: p.currentStock, shortfall: round3(required - p.currentStock) })
        } else {
          warnings.push(`${p.name}: low stock (need ${required}, have ${p.currentStock})`)
        }
      }
    }
    if (insufficient.length) throw { code: 'INSUFFICIENT_STOCK', message: 'Insufficient stock for production run', status: 400, details: insufficient }

    // c5. create ProductionRun row
    const run = await tx.productionRun.create({
      data: {
        businessId,
        bomId: bom.id,
        finishedProductId: bom.productId,
        quantityProduced: round3(quantityProduced),
        runDate,
        status: 'COMPLETED',
        notes: notes ?? null,
        warnings: warnings.length ? warnings : Prisma.JsonNull,
        createdBy: userId,
      },
    })

    // c6. consume components
    let totalCostPaise = 0n
    for (const c of bom.components) {
      const p = byId.get(c.componentProductId)!
      const required = round3(c.quantity * quantityProduced)
      const cost = p.weightedAvgCostPaise
      await tx.stockMovement.create({
        data: { businessId, productId: p.id, type: 'PRODUCTION_CONSUME', quantity: -required, balanceAfter: round3(p.currentStock - required), referenceType: 'PRODUCTION_RUN', referenceId: run.id, createdBy: userId, godownId: null, batchId: null },
      })
      await tx.product.update({ where: { id: p.id }, data: { currentStock: { decrement: required } } })
      await tx.productionRunComponent.create({
        data: { productionRunId: run.id, componentProductId: p.id, quantityConsumed: required, costSnapshotPaise: cost },
      })
      totalCostPaise += BigInt(Math.round(required * Number(cost)))
    }

    // c7. produce finished good + WAC propagation
    const perUnitCostPaise = Math.round(Number(totalCostPaise) / quantityProduced)
    if (perUnitCostPaise > Number.MAX_SAFE_INTEGER) throw { code: 'OVERFLOW', message: 'Per-unit cost overflows safe integer', status: 400 }

    const finished = byId.get(bom.productId)!
    const newWAC = computeWeightedAvg(finished.currentStock, finished.weightedAvgCostPaise, quantityProduced, perUnitCostPaise)
    await tx.stockMovement.create({
      data: { businessId, productId: bom.productId, type: 'PRODUCTION_PRODUCE', quantity: quantityProduced, balanceAfter: round3(finished.currentStock + quantityProduced), referenceType: 'PRODUCTION_RUN', referenceId: run.id, createdBy: userId, godownId: null, batchId: null },
    })
    await tx.product.update({ where: { id: bom.productId }, data: { currentStock: { increment: quantityProduced }, weightedAvgCostPaise: newWAC } })

    // c8. persist idempotency INSIDE tx (atomic with run write)
    const detail = await loadRunDetail(tx as unknown as RunPrismaClient, run.id)
    await storeProductionRunIdempotency(tx, businessId, idempotencyKey, detail, userId)
    return detail
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15_000 })

  // (d) post-commit alert checks (fire-and-forget)
  const allIds = [bom.productId, ...bom.components.map(c => c.componentProductId)]
  for (const pid of allIds) {
    checkAndCreateAlerts(businessId, pid).catch(e => logger.warn('Alert check failed', { pid, e }))
  }

  return result
}
