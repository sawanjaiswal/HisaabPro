/** Payment Tracking — Barrel re-export
 *
 * All payment utils split into focused modules:
 *   payment-validation.utils.ts  — form/amount validation
 *   payment-calculation.utils.ts — discount, allocation, aging, formatting
 */

export {
  validatePaymentAmount,
  validatePaymentForm,
} from './payment-validation.utils'

export {
  calculateDiscount,
  autoAllocateFIFO,
  calculateUnallocatedAmount,
  calculateSettlement,
  calculateAgingTotal,
  getAgingPercentages,
  formatPaymentMode,
  getReferencePlaceholder,
} from './payment-calculation.utils'
