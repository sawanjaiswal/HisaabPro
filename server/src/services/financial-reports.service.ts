/**
 * Financial Reports Service — Barrel re-export
 *
 * All report sub-modules live in ./reports/.
 * Routes import: `import * as reportService from '../services/financial-reports.service.js'`
 */

export { REPORT_ROW_LIMIT } from './reports/helpers.js'
export type { AccountNetMovement } from './reports/helpers.js'
export { getAccountMovements, getBalancesAsOf } from './reports/helpers.js'
export { getProfitAndLoss } from './reports/profit-and-loss.js'
export { getBalanceSheet } from './reports/balance-sheet.js'
export { getCashFlowStatement } from './reports/cash-flow.js'
export { getAgingReport } from './reports/aging.js'
export { getProfitabilityReport } from './reports/profitability.js'
export { getDiscountReport } from './reports/discount.js'
export { getTallyExport, escapeXml } from './reports/tally-export.js'
