/**
 * Recycle bin service — generic CRUD for soft-deleted records.
 * Works with any model in SOFT_DELETE_MODELS.
 */

import { prisma } from '../lib/prisma.js'
import { restoreParty, restoreProduct } from './soft-delete/index.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyModel = any

function getModel(entityType: string): AnyModel {
  const key = entityType.charAt(0).toLowerCase() + entityType.slice(1)
  const model = (prisma as unknown as Record<string, AnyModel>)[key]
  if (!model) throw new Error(`Unknown model: ${entityType}`)
  return model
}

/** List soft-deleted records for a business */
export async function listDeleted(
  businessId: string,
  entityType: string,
  cursor?: string,
  limit = 20,
) {
  const model = getModel(entityType)

  // Build where — explicitly request deleted records
  const where: Record<string, unknown> = { isDeleted: true }

  // Most models have businessId, some (like OpeningBalance) don't
  const modelsWithBusinessId = [
    'Party', 'PartyGroup', 'Product', 'Category', 'Unit',
    'UnitConversion', 'CustomFieldDefinition', 'Document',
    'DocumentNumberSeries', 'TermsAndConditionsTemplate',
    'Payment', 'Expense', 'OtherIncome', 'Cheque', 'BankAccount',
    'LedgerAccount', 'LoanAccount', 'ExpenseCategory', 'TaxCategory',
    'RecurringInvoice', 'Role', 'StaffInvite', 'Batch', 'Godown',
    'SerialNumber',
  ]
  if (modelsWithBusinessId.includes(entityType)) {
    where.businessId = businessId
  }

  const items = await model.findMany({
    where,
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { deletedAt: 'desc' },
  })

  const hasMore = items.length > limit
  if (hasMore) items.pop()

  const total = await model.count({ where })

  return {
    items,
    nextCursor: hasMore ? (items[items.length - 1] as { id: string }).id : null,
    total,
  }
}

/** Verify record belongs to the business before operating on it */
async function verifyOwnership(
  entityType: string,
  id: string,
  businessId: string,
): Promise<void> {
  const model = getModel(entityType)
  const record = await model.findFirst({
    where: { id, businessId, isDeleted: true },
    select: { id: true },
  })
  if (!record) {
    throw new Error('Record not found or does not belong to this business')
  }
}

/** Restore a soft-deleted record (with cascade for Party/Product) */
export async function restoreRecord(
  entityType: string,
  id: string,
  businessId: string,
): Promise<unknown> {
  await verifyOwnership(entityType, id, businessId)

  // Use cascade restore for parent entities
  if (entityType === 'Party') {
    await restoreParty(prisma as AnyModel, id)
    return { restored: true, entityType, id }
  }
  if (entityType === 'Product') {
    await restoreProduct(prisma as AnyModel, id)
    return { restored: true, entityType, id }
  }

  // Generic restore for other models
  const model = getModel(entityType)
  return model.update({
    where: { id },
    data: { isDeleted: false, deletedAt: null },
  })
}

/** Permanently delete a record (bypasses soft-delete extension via raw SQL) */
export async function permanentDelete(
  entityType: string,
  id: string,
  businessId: string,
): Promise<void> {
  await verifyOwnership(entityType, id, businessId)

  // Use parameterized query — entityType is validated by Zod schema (allowlist)
  await (prisma as AnyModel).$executeRawUnsafe(
    `DELETE FROM "${entityType}" WHERE "id" = $1`,
    id,
  )
}
