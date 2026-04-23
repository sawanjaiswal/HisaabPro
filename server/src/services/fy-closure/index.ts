/**
 * Financial Year Closure Service — barrel.
 *
 * Closing a financial year involves:
 *   1. Validating no duplicate closure for the same FY
 *   2. Calculating net P&L (income - expense) for the FY period (April 1 – March 31)
 *   3. Creating a closing journal entry
 *   4. Resetting income/expense account balances to zero
 *   5. Persisting a FinancialYearClosure record
 *
 * Financial year format: "2526" = April 2025 – March 2026
 */
export { closeFY } from './close.js'
export { reopenFY } from './reopen.js'
export { getFYClosures } from './queries.js'
