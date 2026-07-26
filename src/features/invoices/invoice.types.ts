/** Invoicing & Documents — Barrel re-export
 *
 * Re-exports all types from the split files for backward compatibility.
 * New code should import directly from the specific file:
 *   - invoice-enums.types.ts    — union/enum types
 *   - invoice-document.types.ts — document model interfaces
 *   - invoice-api.types.ts      — API responses, forms, filters, settings
 */

export type * from './invoice-enums.types'
export type * from './invoice-document.types'
export type * from './invoice-api.types'

/**
 * What "the user picked this product" carries into a line item. An object, not
 * positional args: the tax category rode along invisibly for months because a
 * 4th scalar was easy to forget at one call site and impossible to spot at the
 * others. Every product-picker (search, frequent chips) emits this shape.
 */
export interface ProductPick {
  productId: string
  name: string
  /** Sale price in PAISE */
  salePrice: number
  /** The product's own GST category — pre-tags the line so a seller who never
   *  opens the tax dropdown still bills GST. null when the product has none. */
  taxCategoryId: string | null
}
