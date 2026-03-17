/** E-Invoice and E-Way Bill compliance types
 *
 * Used for GST Phase 2 e-compliance features integrated into the
 * document detail view. Not standalone pages.
 */

// ─── E-Invoice ────────────────────────────────────────────────────────────────

export interface EInvoiceStatus {
  irn: string | null
  ackNumber: string | null
  ackDate: string | null
  qrCode: string | null
  status: 'PENDING' | 'GENERATED' | 'CANCELLED'
  cancelledAt?: string
  cancelReason?: string
}

export interface EInvoiceGenerateResponse {
  irn: string
  ackNumber: string
  ackDate: string
  signedInvoice: string
  qrCode: string
  status: 'GENERATED'
}

// ─── E-Way Bill ───────────────────────────────────────────────────────────────

export interface EWayBillStatus {
  ewbNumber: string | null
  ewbDate: string | null
  validUntil: string | null
  status: 'PENDING' | 'GENERATED' | 'CANCELLED'
  vehicleNumber?: string
  vehicleType?: string
  transportMode?: string
  cancelledAt?: string
  cancelReason?: string
}

export interface EWayBillGenerateResponse {
  ewbNumber: string
  ewbDate: string
  validUntil: string
  status: 'GENERATED'
}

export type TransportMode = 'ROAD' | 'RAIL' | 'AIR' | 'SHIP'
export type VehicleType = 'REGULAR' | 'ODC'

export interface EWayBillGenerateInput {
  documentId: string
  transportMode: TransportMode
  vehicleNumber?: string
  vehicleType?: VehicleType
  transporterId?: string
  transporterName?: string
  distance: number
  fromPincode: string
  toPincode: string
}

// ─── Document type guard ──────────────────────────────────────────────────────

export type EComplianceDocumentType =
  | 'SALE_INVOICE'
  | 'PURCHASE_INVOICE'

/** Threshold in paise above which e-way bill is required (Rs 50,000 = 5000000 paise) */
export const EWAYBILL_THRESHOLD_PAISE = 5_000_000
