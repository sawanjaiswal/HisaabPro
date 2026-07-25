/** Frequent-products service — "usually bought" suggestions for the invoice
 *  item search. Mirrors the server shape in
 *  server/src/services/party/frequent-products.ts. */

import { api } from '@/lib/api'

/** A repeat-purchase suggestion — everything the item search needs to add a
 *  line in one tap, plus the frequency used for ranking. */
export interface FrequentProduct {
  productId: string
  name: string
  /** Current sale price in PAISE. */
  salePrice: number
  taxCategoryId: string | null
  hsnCode: string | null
  /** Distinct invoices this product appeared on for the party. */
  purchaseCount: number
}

/** GET the party's most-repeated sale-invoice products (already ranked). */
export async function getFrequentProducts(
  partyId: string,
  signal?: AbortSignal,
): Promise<FrequentProduct[]> {
  const { frequentProducts } = await api<{ frequentProducts: FrequentProduct[] }>(
    `/parties/${partyId}/frequent-products`,
    { signal },
  )
  return frequentProducts
}
