/**
 * E-Invoice API service — no offline queue (NIC requires online).
 * Pre-checks navigator.onLine and throws before calling if offline.
 */

import { api } from '@/lib/api'
import type { EInvoiceRecord, CancelReason } from './e-invoice.types'

function requireOnline(): void {
  if (!navigator.onLine) {
    throw new Error('E-Invoice requires an internet connection. Please go online and try again.')
  }
}

export async function generateIrn(documentId: string): Promise<EInvoiceRecord> {
  requireOnline()
  const res = await api<EInvoiceRecord>('/einvoice/generate', {
    method: 'POST',
    body: JSON.stringify({ documentId }),
    // No entityType — don't queue (NIC requires real-time call)
  })
  return res
}

export async function cancelIrn(
  documentId: string,
  reason: CancelReason,
  remarks: string
): Promise<EInvoiceRecord> {
  requireOnline()
  const res = await api<EInvoiceRecord>('/einvoice/cancel', {
    method: 'POST',
    body: JSON.stringify({ documentId, reason, remarks }),
  })
  return res
}

export async function getEInvoice(documentId: string): Promise<EInvoiceRecord> {
  const res = await api<EInvoiceRecord>(`/einvoice/${documentId}`, {
    cacheReads: true,
  })
  return res
}
