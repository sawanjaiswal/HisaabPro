/**
 * Stock give-back guard — the bound on un-receiving goods.
 *
 * `adjustStock` decides whether stock may go OUT (a sale), and under WARN_ONLY
 * it says yes even when the balance goes negative: the shopkeeper physically
 * has the goods, the purchase simply has not been entered yet, and a queue at
 * the counter is worse than a negative number that a later bill reconciles.
 *
 * Taking goods BACK off the shelf — deleting or shrinking a purchase — is the
 * opposite event, and the selling policy has nothing to say about it. If the
 * goods have already gone out to a customer they cannot also be un-received;
 * allowing it leaves a shelf that owes goods, and every number downstream
 * (valuation, reorder alerts, the P&L's cost of sales) inherits the impossible
 * balance with no record of where it came from.
 *
 * So this guard is arithmetic, not policy: it applies whatever the business's
 * stockValidationMode is.
 *
 * It lives at the CALLER (deleteDocument / updateDocument) rather than inside
 * `reverseForInvoice`, because an edit reverses the old lines and re-applies
 * the new ones in the same transaction — a per-movement guard would refuse a
 * correct edit at its intermediate step. Only the caller knows the net.
 */

import type { ExtendedPrismaClient } from '../../lib/prisma.js'
import { insufficientStockError } from '../../lib/errors.js'

type TxClient = Parameters<Parameters<ExtendedPrismaClient['$transaction']>[0]>[0]

/** productId → units about to be taken back off the shelf (always positive). */
export type GiveBack = Map<string, number>

/**
 * Sums the positive stock movements a document created, per product — the
 * quantity `reverseForInvoice` is about to undo. Read from StockMovement
 * rather than from the line items because movements are what actually landed:
 * a line that never moved stock (a service line, a zero quantity) must not
 * make the guard demand stock the document never added.
 */
export async function giveBackForDocument(
  tx: TxClient,
  params: { businessId: string; documentId: string },
): Promise<GiveBack> {
  const movements = await tx.stockMovement.findMany({
    where: { businessId: params.businessId, referenceId: params.documentId },
    select: { productId: true, quantity: true },
  })

  const needed: GiveBack = new Map()
  for (const m of movements) {
    if (m.quantity <= 0) continue
    needed.set(m.productId, (needed.get(m.productId) ?? 0) + m.quantity)
  }
  return needed
}

/**
 * Refuses when any product does not have enough on the shelf to give back.
 *
 * Throws `insufficientStockError` (422) naming the product, so the shopkeeper
 * is told which item blocks the change rather than being handed a generic
 * failure. The right move for them is a purchase return, which takes the stock
 * out through the document trail instead of erasing the receipt of it.
 */
export async function assertStockGiveBackPossible(
  tx: TxClient,
  params: { businessId: string; needed: GiveBack },
): Promise<void> {
  if (params.needed.size === 0) return

  const products = await tx.product.findMany({
    where: { id: { in: [...params.needed.keys()] }, businessId: params.businessId },
    select: { id: true, name: true, currentStock: true },
  })

  for (const product of products) {
    const giveBack = params.needed.get(product.id) ?? 0
    const onShelf = Number(product.currentStock)
    if (giveBack > onShelf) {
      throw insufficientStockError(product.name, onShelf, giveBack, giveBack - onShelf)
    }
  }
}
