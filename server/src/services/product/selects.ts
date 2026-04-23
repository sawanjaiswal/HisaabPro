/**
 * Prisma select objects shared across product sub-modules.
 */

export const productListSelect = {
  id: true,
  name: true,
  sku: true,
  barcode: true,
  barcodeFormat: true,
  salePrice: true,
  purchasePrice: true,
  currentStock: true,
  minStockLevel: true,
  status: true,
  createdAt: true,
  category: { select: { id: true, name: true } },
  unit: { select: { id: true, name: true, symbol: true } },
  taxCategory: { select: { id: true, name: true, rate: true } },
} as const

export const productDetailSelect = {
  id: true,
  businessId: true,
  name: true,
  sku: true,
  barcode: true,
  barcodeFormat: true,
  categoryId: true,
  unitId: true,
  salePrice: true,
  purchasePrice: true,
  currentStock: true,
  minStockLevel: true,
  stockValidation: true,
  hsnCode: true,
  sacCode: true,
  description: true,
  status: true,
  // Feature #108 — Images
  imageUrl: true,
  images: true,
  // Feature #109 — MOQ
  moq: true,
  // Feature #103 — Label template
  labelTemplate: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true } },
  unit: { select: { id: true, name: true, symbol: true } },
  taxCategory: { select: { id: true, name: true, rate: true } },
} as const

export const stockMovementSelect = {
  id: true,
  productId: true,
  type: true,
  quantity: true,
  balanceAfter: true,
  reason: true,
  customReason: true,
  notes: true,
  referenceType: true,
  referenceId: true,
  referenceNumber: true,
  movementDate: true,
  createdAt: true,
  user: { select: { id: true, name: true } },
} as const
