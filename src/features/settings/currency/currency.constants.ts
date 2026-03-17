/** Currency — Constants
 *
 * Rate precision factor: stored as integer * 10000.
 * e.g. 84.50 → 845000. Divide by RATE_PRECISION to display.
 */

export const RATE_PRECISION = 10000

/** Base currency for HisaabPro (Indian Rupee) */
export const BASE_CURRENCY = 'INR'

/** Default pagination page size */
export const CURRENCY_PAGE_SIZE = 20

/** Display label for base currency */
export const BASE_CURRENCY_LABEL = 'Rs'
