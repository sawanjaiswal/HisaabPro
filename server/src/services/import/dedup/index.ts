/**
 * Phase 7 — Import Engine · Dedup barrel.
 *
 * Re-exports the per-entity dedup primitives so call sites (preview
 * service, helpers) can import from a single path. Adding a new
 * entity = add an `export * from './<entity>-dedup.js'` line.
 */

export { findExactDuplicates, type ExactMatch } from './exact-dedup.js'
export { findNearDuplicates, type NearMatch } from './near-dedup.js'
export {
  exactSkuMatch,
  trgmNameMatch,
  type ExactSkuMatch,
  type TrgmNameMatch,
} from './product-dedup.js'
export {
  findPaymentDuplicates,
  type PaymentDupMatch,
  type StagedPaymentLike,
} from './payment-dedup.js'
