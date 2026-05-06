/** Mirror of server EInvoice prisma model + cancel input */

export interface EInvoiceRecord {
  id: string
  documentId: string
  irn: string
  ackNumber: string
  ackDate: string // ISO string
  qrCodeData: string
  signedInvoice: unknown
  status: 'GENERATED' | 'CANCELLED'
  cancelReason: string | null
  cancelledAt: string | null
  createdAt: string
}

export type CancelReason = 1 | 2 | 3 | 4

export const CANCEL_REASON_LABELS: Record<CancelReason, string> = {
  1: 'Duplicate',
  2: 'Data Entry Mistake',
  3: 'Order Cancelled',
  4: 'Other',
}

export interface GenerateIrnInput { documentId: string }

export interface CancelIrnInput {
  documentId: string
  reason: CancelReason
  remarks: string
}
