/**
 * Post a SAVED Document (invoice / credit-note / debit-note) to the GL.
 * Call inside the document mutation's transaction. No-op for document types
 * with no GL impact (estimates, orders, challans → empty map).
 */
import { mapDocument, type DocumentForPosting } from './posting.maps.js'
import { persistPosting } from './index.js'
import type { Tx } from './posting.types.js'

const POSTABLE = new Set(['SALE_INVOICE', 'PURCHASE_INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE'])

/** Prisma select that yields exactly the fields postDocument needs (for re-fetch on edit). */
export const POSTING_DOC_SELECT = {
  id: true, type: true, partyId: true, documentNumber: true, documentDate: true,
  subtotal: true, totalAdditionalCharges: true, roundOff: true, grandTotal: true,
  totalCgst: true, totalSgst: true, totalIgst: true, totalCess: true,
  tdsAmount: true, tcsAmount: true, totalCost: true,
} as const

export interface PostDocumentArgs {
  businessId: string
  userId: string
  doc: DocumentForPosting & { id: string; documentNumber: string | null; documentDate: Date }
}

export async function postDocument(tx: Tx, { businessId, userId, doc }: PostDocumentArgs) {
  if (!POSTABLE.has(doc.type)) return null
  const map = mapDocument(doc)
  return persistPosting(
    tx,
    {
      businessId,
      userId,
      date: doc.documentDate,
      narration: `${doc.type} ${doc.documentNumber ?? doc.id}`,
      sourceType: 'DOCUMENT',
      sourceId: doc.id,
      sourceNumber: doc.documentNumber,
    },
    map,
  )
}
