/**
 * Barrel export — preserves the public surface of reconciliation.service.ts
 * so that all existing importers (`../services/reconciliation.service.js`) can
 * point here once the old file is replaced.
 */

export { startReconciliation } from './matching.engine.js'
export {
  getReconciliation,
  getReconciliationEntries,
  listReconciliations,
  deleteReconciliation,
} from './queries.js'
