/**
 * Document Create — audit-log helpers
 * Extracted from create.ts to keep that file ≤250 LOC.
 */
import type { ExtendedPrismaClient } from '../../lib/prisma.js'

type Tx = Parameters<Parameters<ExtendedPrismaClient['$transaction']>[0]>[0]

interface FreeItemAuditInput {
  businessId: string
  userId: string
  documentId: string
  documentNumber: string | null
  lineItems: Array<{
    isFreeItem?: boolean
    productId: string
    quantity: number
  }>
  purchasePriceMap: Map<string, number>
}

/**
 * #133 BOGO — write an audit-log row for every free line in a saved document
 * so accountants can trace giveaways. No-ops when there are no free lines.
 *
 * Runs inside the same tx as the document insert.
 */
export async function recordFreeItemAudit(
  tx: Tx,
  input: FreeItemAuditInput,
): Promise<void> {
  const freeLines = input.lineItems
    .map((li, i) => ({ li, i }))
    .filter(({ li }) => li.isFreeItem)
  if (freeLines.length === 0) return

  await tx.auditLog.createMany({
    data: freeLines.map(({ li, i }) => ({
      businessId: input.businessId,
      action: 'INVOICE_FREE_ITEM',
      entityType: 'document',
      entityId: input.documentId,
      entityLabel: input.documentNumber,
      userId: input.userId,
      changes: {
        lineIndex: i,
        productId: li.productId,
        quantity: li.quantity,
        purchasePricePaise: input.purchasePriceMap.get(li.productId) ?? 0,
      },
    })),
  })
}
