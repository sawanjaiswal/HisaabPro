/**
 * Backfill background worker — runs product + document updates in the background.
 * Each document/product is wrapped in its own transaction so a single failure
 * doesn't roll back the rest of the batch (Architecture §7.4).
 */

import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import { calculateDocumentTax } from '../tax-calc.js'
import type { TaxLineInput } from '../tax-calc.types.js'
import type { BackfillJobState } from './backfill-store.js'
import { saveJobState, loadJobState } from './backfill-store.js'

export interface ExecuteBackfillPayload {
  defaultTaxCategoryId: string
  dateRange: [Date, Date]
  setPositionFromParty: boolean
}

// ─── Resume detection ────────────────────────────────────────────────────────

async function getAlreadyProcessedIds(
  businessId: string,
  entityType: string,
  jobId: string,
): Promise<Set<string>> {
  const rows = await prisma.auditLog.findMany({
    where: {
      businessId,
      entityType,
      action: 'GST_BACKFILL',
      changes: { path: ['backfillJobId'], equals: jobId },
    },
    select: { entityId: true },
  })
  return new Set(rows.map(r => r.entityId))
}

// ─── Per-document processing ─────────────────────────────────────────────────

async function processDocument(
  docId: string,
  businessId: string,
  userId: string,
  jobId: string,
  payload: ExecuteBackfillPayload,
): Promise<void> {
  await prisma.$transaction(async tx => {
    const [doc, biz] = await Promise.all([
      tx.document.findUniqueOrThrow({
        where: { id: docId, businessId },
        include: {
          party: { select: { stateCode: true } },
          lineItems: { select: { lineTotal: true, taxCategoryId: true, quantity: true } },
        },
      }),
      tx.business.findUniqueOrThrow({ where: { id: businessId }, select: { stateCode: true } }),
    ])

    // Fetch tax category rates for all lines in one query
    const tcIds = [...new Set(doc.lineItems.map(li => li.taxCategoryId).filter(Boolean))] as string[]
    const tcRows = tcIds.length > 0
      ? await tx.taxCategory.findMany({
          where: { id: { in: tcIds } },
          select: { id: true, rate: true, cessRate: true, cessType: true },
        })
      : []
    const tcMap = new Map(tcRows.map(tc => [tc.id, tc]))

    const before = {
      placeOfSupply: doc.placeOfSupply,
      totalCgst: doc.totalCgst,
      totalSgst: doc.totalSgst,
      totalIgst: doc.totalIgst,
      totalCess: doc.totalCess,
      grandTotal: doc.grandTotal,
    }

    let placeOfSupply = doc.placeOfSupply
    if (payload.setPositionFromParty && doc.party?.stateCode) {
      placeOfSupply = doc.party.stateCode
    }

    const supplierState = biz.stateCode ?? ''
    const interState = placeOfSupply !== null && placeOfSupply !== supplierState

    const taxLines: TaxLineInput[] = doc.lineItems.map(li => {
      const tc = li.taxCategoryId ? tcMap.get(li.taxCategoryId) : undefined
      return {
        lineTotal: li.lineTotal,
        gstRate: tc?.rate ?? 0,
        cessRate: tc?.cessRate ?? 0,
        cessType: (tc?.cessType ?? 'PERCENTAGE') as 'PERCENTAGE' | 'FIXED_PER_UNIT',
        quantity: li.quantity,
      }
    })

    const tax = calculateDocumentTax(taxLines, interState)

    await tx.document.update({
      where: { id: docId },
      data: {
        placeOfSupply,
        totalCgst: tax.totalCgst,
        totalSgst: tax.totalSgst,
        totalIgst: tax.totalIgst,
        totalCess: tax.totalCess,
        totalTaxableValue: tax.totalTaxableValue,
      },
    })

    await tx.auditLog.create({
      data: {
        businessId, userId,
        entityType: 'Document', entityId: docId,
        action: 'GST_BACKFILL',
        changes: {
          backfillJobId: jobId, before,
          after: { placeOfSupply, totalCgst: tax.totalCgst, totalSgst: tax.totalSgst, totalIgst: tax.totalIgst, totalCess: tax.totalCess, grandTotal: doc.grandTotal },
        },
      },
    })
  })
}

// ─── Main job runner ─────────────────────────────────────────────────────────

export async function runBackfillJob(
  jobId: string,
  businessId: string,
  userId: string,
  payload: ExecuteBackfillPayload,
  productIds: string[],
  documentIds: string[],
): Promise<void> {
  const state = (await loadJobState(jobId)) as BackfillJobState

  // Products
  const doneProducts = await getAlreadyProcessedIds(businessId, 'Product', jobId)
  const pendingProducts = productIds.filter(id => !doneProducts.has(id))

  for (const productId of pendingProducts) {
    try {
      await prisma.$transaction(async tx => {
        await tx.product.update({
          where: { id: productId, businessId },
          data: { taxCategoryId: payload.defaultTaxCategoryId },
        })
        await tx.auditLog.create({
          data: {
            businessId, userId,
            entityType: 'Product', entityId: productId,
            action: 'GST_BACKFILL',
            changes: { backfillJobId: jobId, before: { taxCategoryId: null }, after: { taxCategoryId: payload.defaultTaxCategoryId } },
          },
        })
      })
      state.processed++
    } catch (err) {
      state.errors.push({ documentId: productId, error: (err as Error).message })
      logger.warn('BACKFILL_PRODUCT_ERROR', { productId, error: (err as Error).message })
    }
    state.heartbeat = Date.now()
    await saveJobState(jobId, state)
  }

  // Documents
  const doneDocs = await getAlreadyProcessedIds(businessId, 'Document', jobId)
  const pendingDocs = documentIds.filter(id => !doneDocs.has(id))

  for (const docId of pendingDocs) {
    try {
      await processDocument(docId, businessId, userId, jobId, payload)
      state.processed++
    } catch (err) {
      state.errors.push({ documentId: docId, error: (err as Error).message })
      logger.warn('BACKFILL_DOCUMENT_ERROR', { docId, error: (err as Error).message })
    }
    state.heartbeat = Date.now()
    await saveJobState(jobId, state)
  }

  state.status = 'COMPLETED'
  state.heartbeat = Date.now()
  await saveJobState(jobId, state)

  // Summary audit row
  await prisma.auditLog.create({
    data: {
      businessId, userId,
      entityType: 'BackfillJob', entityId: jobId,
      action: 'GST_BACKFILL_RUN',
      changes: {
        productsUpdated: pendingProducts.length - state.errors.filter(e => productIds.includes(e.documentId)).length,
        invoicesUpdated: pendingDocs.length - state.errors.filter(e => documentIds.includes(e.documentId)).length,
        errors: state.errors.length,
      },
    },
  })

  logger.info('BACKFILL_JOB_COMPLETED', { jobId, processed: state.processed, total: state.total })
}
