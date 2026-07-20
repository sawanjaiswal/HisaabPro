/** Sales-pipeline view statuses (mockup #45).
 *
 * The mockup labels estimate rows Sent / Accepted / Expired. The stored
 * statuses are DRAFT / SAVED / SHARED / CONVERTED, and "expired" is not
 * stored at all — it is `dueDate` (the valid-till date) in the past on a
 * document nobody converted. This module is the one place that translation
 * happens, so the list rows, the chips and the detail header agree.
 */

import type { DocumentSummary, DocumentStatus } from '../invoices/invoice.types'
import type { SalesDocumentType } from './sales.types'

export type DocumentViewStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'EXPIRED'
export type DocumentViewFilter = 'ALL' | DocumentViewStatus

/** Server status a view filter narrows to, or undefined when it cannot. */
export const VIEW_FILTER_TO_STATUS: Record<DocumentViewFilter, DocumentStatus | undefined> = {
  ALL: undefined,
  DRAFT: 'DRAFT',
  SENT: 'SHARED',
  ACCEPTED: 'CONVERTED',
  // Expiry is derived from dueDate, so the fetch stays wide and the page
  // narrows it in memory.
  EXPIRED: undefined,
}

export function isExpired(document: DocumentSummary, now: Date = new Date()): boolean {
  if (document.status === 'CONVERTED' || document.dueDate === null) return false
  return new Date(document.dueDate).getTime() < now.getTime()
}

export function getViewStatus(document: DocumentSummary): DocumentViewStatus {
  if (document.status === 'CONVERTED') return 'ACCEPTED'
  if (document.status === 'DRAFT') return 'DRAFT'
  if (isExpired(document)) return 'EXPIRED'
  return 'SENT'
}

/** CSS modifier for the row's status word. */
export const VIEW_STATUS_TONE: Record<DocumentViewStatus, string> = {
  DRAFT: 'muted',
  SENT: 'muted',
  ACCEPTED: 'positive',
  EXPIRED: 'negative',
}

/** "Accepted" only reads right on an estimate; orders and challans convert. */
export function acceptedLabelFor(
  type: SalesDocumentType,
  labels: { accepted: string; converted: string },
): string {
  return type === 'ESTIMATE' ? labels.accepted : labels.converted
}
