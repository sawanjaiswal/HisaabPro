/**
 * Party Frequent-Products Service — the "usually bought" intelligence behind
 * the invoice item search. Given a party, returns the products they buy most
 * often across their saved sale invoices, so the seller can re-add a repeat
 * order in one tap instead of searching.
 *
 * Read-only. Tenant-scoped manually via `document.businessId` (no scoped-prisma
 * in this repo yet) so one firm can never see another's purchase history.
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError } from '../../lib/errors.js'

/** A repeat-purchase suggestion — everything the item search needs to add a
 *  line in one tap, plus a frequency hint for ranking/UX. */
export interface FrequentProduct {
  productId: string
  name: string
  /** Current sale price in PAISE (live product price, not the historical rate). */
  salePrice: number
  taxCategoryId: string | null
  hsnCode: string | null
  /** Distinct invoices this product appeared on for the party. */
  purchaseCount: number
}

/** Sale-invoice statuses that represent a real, committed sale (excludes DRAFT
 *  and soft-deleted). SHARED/CONVERTED are still genuine sales. */
const COMMITTED_STATUSES = ['SAVED', 'SHARED', 'CONVERTED'] as const

/** Over-fetch so that filtering out since-deactivated products still leaves a
 *  full row of chips. */
const GROUP_TAKE = 12

export async function getFrequentProducts(
  businessId: string,
  partyId: string,
  limit = 6,
): Promise<FrequentProduct[]> {
  // Verify the party belongs to this business before reading its history.
  const party = await prisma.party.findFirst({
    where: { id: partyId, businessId },
    select: { id: true },
  })
  if (!party) throw notFoundError('Party')

  // Rank products by how many distinct sale invoices they appear on for this
  // party. Freebies (isFreeItem) are excluded — a repeat *purchase* signal.
  const grouped = await prisma.documentLineItem.groupBy({
    by: ['productId'],
    where: {
      isFreeItem: false,
      document: {
        businessId,
        partyId,
        type: 'SALE_INVOICE',
        status: { in: [...COMMITTED_STATUSES] },
        deletedAt: null,
      },
    },
    _count: { productId: true },
    orderBy: { _count: { productId: 'desc' } },
    take: GROUP_TAKE,
  })
  if (grouped.length === 0) return []

  const countByProduct = new Map(grouped.map((g) => [g.productId, g._count.productId]))
  const ids = grouped.map((g) => g.productId)

  // Only surface products still sellable today (active, not deleted). Fetch the
  // live price/tax so the added line matches what the seller sees elsewhere.
  const products = await prisma.product.findMany({
    where: { id: { in: ids }, businessId, status: 'ACTIVE', isDeleted: false },
    select: { id: true, name: true, salePrice: true, taxCategoryId: true, hsnCode: true },
  })
  const byId = new Map(products.map((p) => [p.id, p]))

  // Preserve the frequency ranking from groupBy (findMany order is undefined).
  return ids
    .map((id) => {
      const p = byId.get(id)
      if (!p) return null
      return {
        productId: p.id,
        name: p.name,
        salePrice: p.salePrice,
        taxCategoryId: p.taxCategoryId,
        hsnCode: p.hsnCode,
        purchaseCount: countByProduct.get(id) ?? 0,
      } satisfies FrequentProduct
    })
    .filter((x): x is FrequentProduct => x !== null)
    .slice(0, limit)
}
