/**
 * Batch claim helpers for sale-invoice deduction (BAT-03).
 *
 * Split out of invoice-ops.ts, which owns the per-item dispatch; these two are
 * the two ways a batch-tracked line finds its stock — a batch the seller picked
 * themselves, or FEFO picking it for them.
 */

import type { ExtendedPrismaClient } from '../../lib/prisma.js'
import { claimBatchesFEFO } from './batch-claim.service.js'
import { checkSingleBatch, type ExpiryPolicy, type ExpiryWarning } from './expiry-policy.js'
import { stockShortageError, batchProductMismatchError, notFoundError } from '../../lib/errors.js'
import logger from '../../lib/logger.js'
// Type-only import — erased at compile time, so the pair does not form a
// runtime cycle even though invoice-ops.ts imports the claims below.
import type { InvoiceStockItem } from './invoice-ops.js'

type TxClient = Parameters<Parameters<ExtendedPrismaClient['$transaction']>[0]>[0]

interface ClaimParams {
  businessId: string
  invoiceId: string
  invoiceNumber: string
  userId: string
  /** Movement labels — see document/helpers.ts stockMovementLabels(). */
  movementType?: string
  movementReferenceType?: string
}

type BatchRow = { id: string; batchNumber: string; expiryDate: Date | null; currentStock: number; productId: string; costPrice: number | null }

export async function claimClientBatch(
  tx: TxClient,
  item: InvoiceStockItem,
  params: ClaimParams,
  policy: ExpiryPolicy,
  today: Date,
  results: object[],
  warnings: string[]
) {
  const batchRows = await tx.$queryRaw<BatchRow[]>`
    SELECT b.id, b."batchNumber", b."expiryDate", b."currentStock",
           b."productId", b."costPrice"
    FROM "Batch" b
    WHERE b.id = ${item.batchId!}
      AND b."businessId" = ${params.businessId}
      AND b."isDeleted" = false
    FOR UPDATE
  `

  if (batchRows.length === 0) throw notFoundError('Batch', { batchId: item.batchId })
  const br = batchRows[0]

  if (br.productId !== item.productId) throw batchProductMismatchError(item.batchId!, item.productId)

  const batchForPolicy = {
    id: br.id, batchNumber: br.batchNumber, expiryDate: br.expiryDate,
    productId: br.productId, productName: item.productName ?? br.productId,
    currentStock: Number(br.currentStock),
    costPriceAtClaim: br.costPrice != null ? BigInt(br.costPrice) : null,
  }

  const warning: ExpiryWarning | null = checkSingleBatch(batchForPolicy, policy, today)
  if (warning) {
    warnings.push(
      `Batch "${warning.batchNumber}" expired on ${warning.expiryDate.toISOString().split('T')[0]} — sold under WARN_ONLY policy`
    )
  }

  const updated = await tx.$queryRaw<Array<{ id: string }>>`
    UPDATE "Batch" SET "currentStock" = "currentStock" - ${item.quantity}
    WHERE id = ${item.batchId!} AND "currentStock" >= ${item.quantity}
    RETURNING id
  `

  if (updated.length === 0) {
    throw stockShortageError([{
      productId: item.productId, productName: item.productName ?? item.productId,
      requested: item.quantity, available: Number(br.currentStock),
    }])
  }

  const movement = await tx.stockMovement.create({
    data: {
      businessId: params.businessId, productId: item.productId,
      type: params.movementType ?? 'SALE',
      quantity: -item.quantity, balanceAfter: 0, batchId: item.batchId,
      referenceType: params.movementReferenceType ?? 'SALE_INVOICE', referenceId: params.invoiceId,
      referenceNumber: params.invoiceNumber, movementDate: new Date(), createdBy: params.userId,
    },
  })
  results.push(movement)
  logger.info('Client-supplied batch sale movement emitted', { batchId: item.batchId, qtyTaken: item.quantity })
}

export async function claimFEFO(
  tx: TxClient,
  item: InvoiceStockItem,
  params: ClaimParams,
  policy: ExpiryPolicy,
  results: object[],
  warnings: string[]
) {
  const { claims, warnings: claimWarnings } = await claimBatchesFEFO(
    tx, item.productId, item.quantity,
    { policy, productName: item.productName }
  )
  warnings.push(...claimWarnings)

  for (const claim of claims) {
    const movement = await tx.stockMovement.create({
      data: {
        businessId: params.businessId, productId: item.productId,
        type: params.movementType ?? 'SALE',
        quantity: -claim.qtyTaken, balanceAfter: 0, batchId: claim.batchId,
        referenceType: params.movementReferenceType ?? 'SALE_INVOICE', referenceId: params.invoiceId,
        referenceNumber: params.invoiceNumber, movementDate: new Date(), createdBy: params.userId,
      },
    })
    results.push(movement)
    logger.info('Batch FEFO movement emitted', {
      batchId: claim.batchId, qtyTaken: claim.qtyTaken, invoiceId: params.invoiceId,
    })
  }
}
