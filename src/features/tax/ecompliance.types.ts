/**
 * E-Compliance types — E-Invoice, E-Way Bill, GST Returns, Recurring Invoices
 * These are Phase 2 Batch D/E types, defined early for schema completeness.
 */

/** E-Invoice record — IRN + QR from NIC IRP portal */
export interface EInvoice {
  id: string
  documentId: string
  irn: string
  ackNumber: string
  ackDate: string
  qrCodeData: string
  status: 'GENERATED' | 'CANCELLED'
  cancelReason: string | null
  createdAt: string
}

/** E-Way Bill record */
export interface EWayBill {
  id: string
  documentId: string
  ewbNumber: string
  ewbDate: string
  validUpto: string
  transportMode: 'ROAD' | 'RAIL' | 'AIR' | 'SHIP'
  vehicleNumber: string | null
  distance: number
  status: 'ACTIVE' | 'CANCELLED' | 'EXTENDED'
  createdAt: string
}

/** GST Return filing tracker */
export interface GstReturn {
  id: string
  businessId: string
  period: string         // "2026-01"
  returnType: 'GSTR1' | 'GSTR3B' | 'GSTR9'
  status: 'DRAFT' | 'EXPORTED' | 'FILED'
  invoiceCount: number
  totalTaxableValue: number
  totalTax: number
  createdAt: string
}

/** Recurring Invoice template */
export interface RecurringInvoice {
  id: string
  businessId: string
  partyId: string
  frequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
  startDate: string
  endDate: string | null
  nextRunDate: string
  autoSend: boolean
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED'
  generatedCount: number
  lastGeneratedAt: string | null
}
