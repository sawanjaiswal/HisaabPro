/** Invoicing & Documents — Barrel re-export
 *
 * Re-exports all service functions and types from the split service files.
 * Existing imports from './invoice.service' continue to work unchanged.
 *
 * Service files:
 *   invoice-crud.service.ts    — CRUD, stock validation, conversion, number series
 *   invoice-share.service.ts   — WhatsApp, email, shareable link, export
 *   invoice-recycle.service.ts — Recycle bin (list, restore, permanent delete, empty)
 */

// ─── CRUD, Stock, Conversion, Number Series ──────────────────────────────────
export {
  buildDocumentQuery,
  validateStock,
  getDocuments,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
  convertDocument,
  getNextDocumentNumber,
  updateNumberSeries,
} from './invoice-crud.service'

export type {
  StockValidationItem,
  StockValidationResult,
} from './invoice-crud.service'

// ─── Sharing & Export ────────────────────────────────────────────────────────
export {
  shareViaWhatsApp,
  shareViaEmail,
  getShareableLink,
  exportDocument,
} from './invoice-share.service'

export type {
  ShareWhatsAppRequest,
  ShareEmailRequest,
} from './invoice-share.service'

// ─── Recycle Bin ─────────────────────────────────────────────────────────────
export {
  getRecycleBin,
  restoreDocument,
  permanentDeleteDocument,
  emptyRecycleBin,
} from './invoice-recycle.service'

export type {
  RecycleBinFilters,
  EmptyRecycleBinResponse,
  PermanentDeleteOptions,
} from './invoice-recycle.service'
