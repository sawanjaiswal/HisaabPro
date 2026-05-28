/**
 * #147 Bank reconciliation service — public surface.
 * Implementation split across import.service (staging + listing) and
 * match.service (manual/auto match, ignore, un-reconcile); shared DB access
 * lives in bank-reconciliation.repository.
 */
export { createImport, listLines } from './import.service.js'
export type { CreateImportResult } from './import.service.js'
export {
  matchLineManual,
  confirmLineAuto,
  ignoreLine,
  unreconcileLine,
} from './match.service.js'
