/**
 * Tax utilities — barrel re-export from split modules.
 * Import from here for convenience, or from individual files directly.
 */

// Tax calculation engine (must match backend tax-calc.ts)
export {
  isInterState,
  calculateLineTax,
  calculateDocumentTax,
} from './tax-calc.utils'
export type { TaxLineInput } from './tax-calc.utils'

// GSTIN validation & supply type
export {
  validateGstin,
  extractStateCode,
  determineSupplyType,
  formatGstRate,
} from './gstin.utils'
