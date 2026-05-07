/** POS — Full DTO types mirroring backend */

export type PaymentMode = 'CASH' | 'UPI' | 'CARD' | 'CHEQUE' | 'BANK_TRANSFER' | 'CREDIT'

export type PosSaleStatus = 'ACTIVE' | 'VOIDED'

export type ReceiptWidth = '58mm' | '80mm' | 'A5'

// ─── API DTOs ────────────────────────────────────────────────────────────────

export interface PosProductDTO {
  id: string
  name: string
  sku: string
  salePrice: number        // paise
  mrp?: number             // paise
  stock: number
  unit: string
  categoryId?: string
  categoryName?: string
  hsnCode?: string
  taxRate?: number         // percent e.g. 18
  imageUrl?: string
}

export interface PaymentSplitDTO {
  mode: PaymentMode
  amountPaise: number
  referenceNumber?: string
  note?: string
}

export interface PosSaleItemDTO {
  id: string
  productId: string
  productName: string
  sku: string
  hsnCode?: string
  quantity: number
  unitPrice: number        // paise
  discount: number         // paise
  taxableValue: number     // paise
  cgst: number             // paise
  sgst: number             // paise
  igst: number             // paise
  cess: number             // paise
  lineTotal: number        // paise
}

export interface PosSaleDTO {
  id: string
  receiptNumber: string
  receiptSeq: number
  financialYear: string
  status: PosSaleStatus
  partyId?: string
  partyName?: string
  walkInName?: string
  walkInPhone?: string
  subtotal: number
  totalDiscount: number
  totalTaxableValue: number
  totalCgst: number
  totalSgst: number
  totalIgst: number
  totalCess: number
  grandTotal: number
  paymentBreakdown: PaymentSplitDTO[]
  taxPricingMode: 'INCLUSIVE' | 'EXCLUSIVE'
  cashierId: string
  cashierName?: string
  voidReason?: string
  voidedAt?: string
  createdAt: string
  items: PosSaleItemDTO[]
}

export interface PosListResponse {
  sales: PosSaleDTO[]
  nextCursor?: string
  totalCount: number
}

export interface PosProductsResponse {
  products: PosProductDTO[]
  nextCursor?: string
}

export interface ShareReceiptResponse {
  link: string
  channel: 'WHATSAPP' | 'EMAIL'
  expires: string
}

// ─── Cart types ──────────────────────────────────────────────────────────────

export interface PosCartItem {
  productId: string
  name: string
  sku: string
  hsnCode?: string
  quantity: number
  unitPrice: number        // paise
  discount: number         // paise (total line discount)
  stock: number
  taxRate: number          // percent
  unit: string
}

export interface PosCartTotals {
  subtotal: number
  totalDiscount: number
  totalTaxable: number
  totalTax: number
  grandTotal: number
}

export interface PaymentSplit {
  mode: PaymentMode
  amount: number           // paise
  referenceNumber?: string
}

// ─── Filter types ────────────────────────────────────────────────────────────

export interface PosHistoryFilters {
  from?: string
  to?: string
  status?: PosSaleStatus | ''
  cashierId?: string
  paymentMode?: PaymentMode | ''
  cursor?: string
  limit: number
}
