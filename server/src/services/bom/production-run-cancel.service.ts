/**
 * Production Run Cancellation service.
 * Reverses stock movements (PRODUCTION_REVERSE). Does NOT reverse WAC.
 * Only COMPLETED runs can be cancelled.
 */

import { prisma } from '../../lib/prisma.js'
import { Prisma } from '@prisma/client'

type ValidationMode = 'WARN_ONLY' | 'HARD_BLOCK'

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

export async function cancelProductionRun(args: {
  businessId: string
  runId: string
  userId: string
}): Promise<{ id: string; status: 'CANCELLED' }> {
  const { businessId, runId, userId } = args

  return prisma.$transaction(async (tx) => {
    const run = await tx.productionRun.findFirst({
      where: { id: runId, businessId, isDeleted: false },
      include: {
        components: {
          select: {
            componentProductId: true,
            quantityConsumed: true,
          },
        },
      },
    })
    if (!run) throw { code: 'RUN_NOT_FOUND', message: 'Production run not found', status: 404 }
    if (run.status === 'CANCELLED') throw { code: 'ALREADY_CANCELLED', message: 'Production run is already cancelled', status: 400 }
    if (run.status !== 'COMPLETED') throw { code: 'INVALID_STATUS', message: 'Only completed runs can be cancelled', status: 400 }

    // Lock all involved products in stable sorted order
    const productIds = [
      run.finishedProductId,
      ...run.components.map(c => c.componentProductId),
    ].sort()
    await tx.$queryRawUnsafe<unknown[]>(
      `SELECT id FROM "Product" WHERE id = ANY($1::text[]) ORDER BY id FOR UPDATE`,
      productIds
    )

    // Resolve effective validation mode for finished good
    const setting = await tx.inventorySetting.findUnique({
      where: { businessId },
      select: { stockValidationMode: true },
    })
    const businessMode = (setting?.stockValidationMode as ValidationMode) ?? 'WARN_ONLY'
    const finished = await tx.product.findUniqueOrThrow({
      where: { id: run.finishedProductId },
      select: { currentStock: true, stockValidation: true },
    })
    const effFinishedMode: ValidationMode =
      finished.stockValidation === 'GLOBAL' ? businessMode : (finished.stockValidation as ValidationMode)

    // Guard: finished-good cannot go negative under HARD_BLOCK
    if (effFinishedMode === 'HARD_BLOCK' && finished.currentStock < run.quantityProduced) {
      throw { code: 'INSUFFICIENT_STOCK_TO_CANCEL', message: 'Finished product stock would go negative; cannot cancel', status: 409 }
    }

    // Fetch component current stocks for balanceAfter calculation
    const componentIds = run.components.map(c => c.componentProductId)
    const componentProducts = await tx.product.findMany({
      where: { id: { in: componentIds } },
      select: { id: true, currentStock: true },
    })
    const compById = new Map(componentProducts.map(p => [p.id, p]))

    // Reverse component movements: restore component stock
    for (const c of run.components) {
      const comp = compById.get(c.componentProductId)
      const currentStock = comp?.currentStock ?? 0
      await tx.stockMovement.create({
        data: {
          businessId,
          productId: c.componentProductId,
          type: 'PRODUCTION_REVERSE',
          quantity: c.quantityConsumed,
          balanceAfter: round3(currentStock + c.quantityConsumed),
          referenceType: 'PRODUCTION_RUN',
          referenceId: run.id,
          createdBy: userId,
          godownId: null,
          batchId: null,
        },
      })
      await tx.product.update({
        where: { id: c.componentProductId },
        data: { currentStock: { increment: c.quantityConsumed } },
      })
    }

    // Reverse finished product movement: decrement finished stock
    await tx.stockMovement.create({
      data: {
        businessId,
        productId: run.finishedProductId,
        type: 'PRODUCTION_REVERSE',
        quantity: -run.quantityProduced,
        balanceAfter: round3(finished.currentStock - run.quantityProduced),
        referenceType: 'PRODUCTION_RUN',
        referenceId: run.id,
        createdBy: userId,
        godownId: null,
        batchId: null,
      },
    })
    await tx.product.update({
      where: { id: run.finishedProductId },
      data: { currentStock: { decrement: run.quantityProduced } },
    })

    // weightedAvgCostPaise intentionally NOT reversed (directional accumulator pattern)

    await tx.productionRun.update({
      where: { id: run.id },
      data: { status: 'CANCELLED' },
    })

    return { id: run.id, status: 'CANCELLED' as const }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 10_000 })
}
