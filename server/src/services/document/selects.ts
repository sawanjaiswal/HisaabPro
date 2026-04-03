/**
 * Document Service — Prisma select objects for list and detail queries
 */

export const DOCUMENT_LIST_SELECT = {
  id: true,
  type: true,
  status: true,
  documentNumber: true,
  documentDate: true,
  dueDate: true,
  subtotal: true,
  totalDiscount: true,
  totalAdditionalCharges: true,
  roundOff: true,
  grandTotal: true,
  totalProfit: true,
  paidAmount: true,
  balanceDue: true,
  originalDocumentId: true,
  totalTaxableValue: true,
  totalCgst: true,
  totalSgst: true,
  totalIgst: true,
  totalCess: true,
  createdAt: true,
  updatedAt: true,
  party: {
    select: { id: true, name: true, phone: true },
  },
  _count: {
    select: { lineItems: true },
  },
} as const

export const DOCUMENT_DETAIL_SELECT = {
  id: true,
  type: true,
  status: true,
  documentNumber: true,
  sequenceNumber: true,
  financialYear: true,
  documentDate: true,
  dueDate: true,
  paymentTerms: true,
  shippingAddressId: true,
  subtotal: true,
  totalDiscount: true,
  totalAdditionalCharges: true,
  roundOff: true,
  grandTotal: true,
  totalCost: true,
  totalProfit: true,
  profitPercent: true,
  paidAmount: true,
  balanceDue: true,
  notes: true,
  termsAndConditions: true,
  includeSignature: true,
  vehicleNumber: true,
  driverName: true,
  transportNotes: true,
  // GST Phase 2
  placeOfSupply: true,
  supplyType: true,
  isReverseCharge: true,
  isComposite: true,
  totalTaxableValue: true,
  totalCgst: true,
  totalSgst: true,
  totalIgst: true,
  totalCess: true,
  // TDS/TCS Phase 2B
  tdsRate: true,
  tdsAmount: true,
  tcsRate: true,
  tcsAmount: true,
  // CN/DN
  originalDocumentId: true,
  creditDebitReason: true,
  sourceDocumentId: true,
  clientId: true,
  deletedAt: true,
  createdBy: true,
  updatedBy: true,
  createdAt: true,
  updatedAt: true,
  party: {
    select: {
      id: true, name: true, phone: true, email: true, gstin: true,
      outstandingBalance: true,
      addresses: {
        select: {
          id: true, line1: true, line2: true, city: true,
          state: true, pincode: true, type: true, isDefault: true,
        },
      },
    },
  },
  lineItems: {
    select: {
      id: true, sortOrder: true, quantity: true, rate: true,
      discountType: true, discountValue: true, discountAmount: true,
      lineTotal: true, purchasePrice: true, profit: true, profitPercent: true,
      stockBefore: true, stockAfter: true,
      // GST Phase 2
      taxCategoryId: true, hsnCode: true, sacCode: true,
      taxableValue: true, cgstRate: true, cgstAmount: true,
      sgstRate: true, sgstAmount: true, igstRate: true, igstAmount: true,
      cessRate: true, cessAmount: true,
      product: {
        select: {
          id: true, name: true, sku: true, currentStock: true,
          unit: { select: { symbol: true } },
        },
      },
    },
    orderBy: { sortOrder: 'asc' as const },
  },
  additionalCharges: {
    select: {
      id: true, name: true, type: true, value: true, amount: true, sortOrder: true,
    },
    orderBy: { sortOrder: 'asc' as const },
  },
  sourceDocument: {
    select: { id: true, type: true, documentNumber: true },
  },
  convertedTo: {
    select: { id: true, type: true, documentNumber: true },
  },
  originalDocument: {
    select: { id: true, type: true, documentNumber: true, grandTotal: true },
  },
  creditDebitNotes: {
    select: { id: true, type: true, documentNumber: true, grandTotal: true, documentDate: true, creditDebitReason: true },
    orderBy: { documentDate: 'desc' as const },
  },
  shareLogs: {
    select: {
      id: true, channel: true, format: true, sentAt: true,
      recipientPhone: true, recipientEmail: true, fileUrl: true,
      fileSize: true, message: true,
      user: { select: { id: true, name: true } },
    },
    orderBy: { sentAt: 'desc' as const },
    take: 20,
  },
  creator: { select: { id: true, name: true } },
} as const
