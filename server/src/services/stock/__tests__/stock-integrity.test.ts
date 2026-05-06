/**
 * Hard Gate — INV-04 → INV-05 stock integrity round-trip.
 *
 * Verifies:
 *   SUM(StockMovement.quantity) == Product.currentStock after every op.
 *   Weighted-avg cost is correct after two purchases.
 *   Voiding (reversal) of a sale restores stock correctly.
 *
 * Round-trip sequence:
 *   PURCHASE  100 @ Rs 10  (₹1 000 total cost)
 *   SALE       30
 *   ADJUSTMENT_OUT  5  (damage)
 *   PURCHASE   50 @ Rs 13  (₹650 total cost)
 *   SALE       40
 *   VOID sale-2  (reverse -40 → +40)
 *
 * Final currentStock: 100 - 30 - 5 + 50 - 40 + 40 = 115
 * Weighted-avg after both purchases:
 *   (100×10 + 50×13) / 150 = 1650/150 = 11.00 → 1100 paise
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── In-memory state ───────────────────────────────────────────────────────────

interface ProductRow {
  id: string
  name: string
  currentStock: number
  weightedAvgCostPaise: bigint
  minStockLevel: number
  stockValidation: string
  businessId: string
}

interface MovementRow {
  id: string
  productId: string
  businessId: string
  type: string
  quantity: number
  balanceAfter: number
  reason: string | null
  customReason: string | null
  notes: string | null
  referenceType: string | null
  referenceId: string | null
  referenceNumber: string | null
  movementDate: Date
  createdBy: string
  createdAt: Date
}

const BIZ = 'biz-test'
const PROD = 'prod-test'
const USER = 'user-test'

let product: ProductRow
let movements: MovementRow[]
let movementSeq = 0
let invSeqSale = 0
let invSeqPurchase = 0

function resetState() {
  movementSeq = 0
  invSeqSale = 0
  invSeqPurchase = 0
  product = {
    id: PROD,
    name: 'Test Product',
    currentStock: 0,
    weightedAvgCostPaise: BigInt(0),
    minStockLevel: 0,
    stockValidation: 'WARN_ONLY',
    businessId: BIZ,
  }
  movements = []
}

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { mockQueryRaw, mockProductUpdate, mockProductFindUnique, mockMovementCreate, mockMovementFindMany, mockInvSettingFindUnique } =
  vi.hoisted(() => ({
    mockQueryRaw: vi.fn(),
    mockProductUpdate: vi.fn(),
    mockProductFindUnique: vi.fn(),
    mockMovementCreate: vi.fn(),
    mockMovementFindMany: vi.fn(),
    mockInvSettingFindUnique: vi.fn(),
  }))

vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    product: {
      update: mockProductUpdate,
      findUnique: mockProductFindUnique,
    },
    stockMovement: {
      create: mockMovementCreate,
      findMany: mockMovementFindMany,
    },
    inventorySetting: { findUnique: mockInvSettingFindUnique },
  },
}))

vi.mock('../../../lib/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// ── Import services AFTER mocks ───────────────────────────────────────────────

import { adjustStock } from '../core.js'
import { addForPurchaseInvoice, deductForSaleInvoice, reverseForInvoice } from '../invoice-ops.js'

// ── Mock TX factory ───────────────────────────────────────────────────────────

/** Build a pseudo-tx object wired to the mocks. */
function makeTx() {
  return {
    $queryRaw: mockQueryRaw,
    product: { update: mockProductUpdate, findUnique: mockProductFindUnique },
    stockMovement: { create: mockMovementCreate, findMany: mockMovementFindMany },
    inventorySetting: { findUnique: mockInvSettingFindUnique },
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Wire mocks so adjustStock/addForPurchaseInvoice behave against in-memory state. */
function wireStateMocks() {
  // SELECT FOR UPDATE — returns current product row
  mockQueryRaw.mockImplementation(() =>
    Promise.resolve([
      {
        id: product.id,
        name: product.name,
        current_stock: product.currentStock,
        min_stock_level: product.minStockLevel,
        stock_validation: product.stockValidation,
        business_id: product.businessId,
      },
    ])
  )

  // product.update — applies delta to in-memory state
  mockProductUpdate.mockImplementation(({ data }: { data: Partial<ProductRow> }) => {
    if (data.currentStock !== undefined) product.currentStock = data.currentStock
    if (data.weightedAvgCostPaise !== undefined) product.weightedAvgCostPaise = data.weightedAvgCostPaise as bigint
    return Promise.resolve(product)
  })

  // product.findUnique — returns current product for weighted-avg reads
  mockProductFindUnique.mockImplementation(() =>
    Promise.resolve({ weightedAvgCostPaise: product.weightedAvgCostPaise })
  )

  // stockMovement.create — records movement in memory
  mockMovementCreate.mockImplementation(({ data, select }: { data: Omit<MovementRow, 'id' | 'createdAt'>; select?: object }) => {
    movementSeq++
    const mov: MovementRow = {
      id: `mov-${movementSeq}`,
      ...data,
      createdAt: new Date(),
    } as MovementRow
    movements.push(mov)
    // Return only selected fields (select is always defined in adjustStock, but we return full object — harmless)
    return Promise.resolve(mov)
  })

  // stockMovement.findMany — returns movements for a given referenceId
  mockMovementFindMany.mockImplementation(({ where }: { where: { businessId: string; referenceId: string } }) =>
    Promise.resolve(
      movements
        .filter((m) => m.businessId === where.businessId && m.referenceId === where.referenceId)
        .map((m) => ({ productId: m.productId, quantity: m.quantity }))
    )
  )

  // inventorySetting.findUnique — WARN_ONLY (allows negative stock without throwing)
  mockInvSettingFindUnique.mockResolvedValue({ stockValidationMode: 'WARN_ONLY', lowStockAlertEnabled: false })
}

// ── Assertion helper ─────────────────────────────────────────────────────────

function assertIntegrity(expectedStock: number, expectedMovCount: number, label: string) {
  const sumQty = movements.reduce((acc, m) => acc + m.quantity, 0)
  expect(sumQty, `${label}: SUM(movement.quantity) should equal currentStock`).toBeCloseTo(
    product.currentStock,
    6
  )
  expect(product.currentStock, `${label}: currentStock`).toBeCloseTo(expectedStock, 6)
  expect(movements.length, `${label}: movement count`).toBe(expectedMovCount)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Stock integrity — hard-gate round-trip', () => {
  beforeEach(() => {
    resetState()
    vi.clearAllMocks()
    wireStateMocks()
  })

  it('maintains SUM(movements) == currentStock after every operation', async () => {
    const tx = makeTx() as any

    // ─ 1. PURCHASE 100 @ Rs 10 (1000 paise) ─────────────────────────────────
    invSeqPurchase++
    await addForPurchaseInvoice(tx, {
      businessId: BIZ,
      invoiceId: `inv-purchase-${invSeqPurchase}`,
      invoiceNumber: `PO-${invSeqPurchase}`,
      items: [{ productId: PROD, quantity: 100, unitCostPaise: 1000 }],
      userId: USER,
    })
    assertIntegrity(100, 1, 'After PURCHASE 100@1000p')

    // ─ 2. SALE 30 ────────────────────────────────────────────────────────────
    invSeqSale++
    const sale1InvoiceId = `inv-sale-${invSeqSale}`
    await deductForSaleInvoice(tx, {
      businessId: BIZ,
      invoiceId: sale1InvoiceId,
      invoiceNumber: `SI-${invSeqSale}`,
      items: [{ productId: PROD, quantity: 30 }],
      userId: USER,
    })
    assertIntegrity(70, 2, 'After SALE 30')

    // ─ 3. ADJUSTMENT_OUT 5 (damage) ─────────────────────────────────────────
    await adjustStock(tx, {
      productId: PROD,
      businessId: BIZ,
      quantity: -5,
      type: 'ADJUSTMENT_OUT',
      reason: 'DAMAGE',
      userId: USER,
    })
    assertIntegrity(65, 3, 'After ADJUSTMENT_OUT 5')

    // ─ 4. PURCHASE 50 @ Rs 13 (1300 paise) ──────────────────────────────────
    invSeqPurchase++
    await addForPurchaseInvoice(tx, {
      businessId: BIZ,
      invoiceId: `inv-purchase-${invSeqPurchase}`,
      invoiceNumber: `PO-${invSeqPurchase}`,
      items: [{ productId: PROD, quantity: 50, unitCostPaise: 1300 }],
      userId: USER,
    })
    assertIntegrity(115, 4, 'After PURCHASE 50@1300p')

    // ─ 5. SALE 40 ────────────────────────────────────────────────────────────
    invSeqSale++
    const sale2InvoiceId = `inv-sale-${invSeqSale}`
    await deductForSaleInvoice(tx, {
      businessId: BIZ,
      invoiceId: sale2InvoiceId,
      invoiceNumber: `SI-${invSeqSale}`,
      items: [{ productId: PROD, quantity: 40 }],
      userId: USER,
    })
    assertIntegrity(75, 5, 'After SALE 40')

    // ─ 6. VOID sale-2 (reverse the second sale of -40 → +40) ────────────────
    await reverseForInvoice(tx, {
      businessId: BIZ,
      invoiceId: sale2InvoiceId,
      userId: USER,
    })
    assertIntegrity(115, 6, 'After VOID sale-2')
  })

  it('final currentStock is 115 (hand-computed: 100-30-5+50-40+40)', async () => {
    const tx = makeTx() as any

    invSeqPurchase++
    await addForPurchaseInvoice(tx, {
      businessId: BIZ,
      invoiceId: `inv-purchase-${invSeqPurchase}`,
      invoiceNumber: `PO-${invSeqPurchase}`,
      items: [{ productId: PROD, quantity: 100, unitCostPaise: 1000 }],
      userId: USER,
    })

    invSeqSale++
    await deductForSaleInvoice(tx, {
      businessId: BIZ,
      invoiceId: `inv-sale-${invSeqSale}`,
      invoiceNumber: `SI-${invSeqSale}`,
      items: [{ productId: PROD, quantity: 30 }],
      userId: USER,
    })

    await adjustStock(tx, {
      productId: PROD,
      businessId: BIZ,
      quantity: -5,
      type: 'ADJUSTMENT_OUT',
      reason: 'DAMAGE',
      userId: USER,
    })

    invSeqPurchase++
    await addForPurchaseInvoice(tx, {
      businessId: BIZ,
      invoiceId: `inv-purchase-${invSeqPurchase}`,
      invoiceNumber: `PO-${invSeqPurchase}`,
      items: [{ productId: PROD, quantity: 50, unitCostPaise: 1300 }],
      userId: USER,
    })

    invSeqSale++
    const sale2Id = `inv-sale-${invSeqSale}`
    await deductForSaleInvoice(tx, {
      businessId: BIZ,
      invoiceId: sale2Id,
      invoiceNumber: `SI-${invSeqSale}`,
      items: [{ productId: PROD, quantity: 40 }],
      userId: USER,
    })

    await reverseForInvoice(tx, {
      businessId: BIZ,
      invoiceId: sale2Id,
      userId: USER,
    })

    expect(product.currentStock).toBe(115)
  })

  it('weighted-avg cost after two purchases is 1100 paise (= Rs 11)', async () => {
    const tx = makeTx() as any

    // PURCHASE 100 @ 1000p → avg = 1000p
    invSeqPurchase++
    await addForPurchaseInvoice(tx, {
      businessId: BIZ,
      invoiceId: `inv-purchase-${invSeqPurchase}`,
      invoiceNumber: `PO-${invSeqPurchase}`,
      items: [{ productId: PROD, quantity: 100, unitCostPaise: 1000 }],
      userId: USER,
    })

    expect(product.weightedAvgCostPaise).toBe(BigInt(1000))

    // PURCHASE 50 @ 1300p
    // avg = (100×1000 + 50×1300) / 150 = (100000 + 65000) / 150 = 165000/150 = 1100
    invSeqPurchase++
    await addForPurchaseInvoice(tx, {
      businessId: BIZ,
      invoiceId: `inv-purchase-${invSeqPurchase}`,
      invoiceNumber: `PO-${invSeqPurchase}`,
      items: [{ productId: PROD, quantity: 50, unitCostPaise: 1300 }],
      userId: USER,
    })

    expect(product.weightedAvgCostPaise).toBe(BigInt(1100))
  })

  it('no orphan movements — movement count equals exact expected delta per op', async () => {
    const tx = makeTx() as any

    invSeqPurchase++
    await addForPurchaseInvoice(tx, {
      businessId: BIZ,
      invoiceId: `inv-purchase-${invSeqPurchase}`,
      invoiceNumber: `PO-${invSeqPurchase}`,
      items: [{ productId: PROD, quantity: 100, unitCostPaise: 1000 }],
      userId: USER,
    })
    expect(movements.length).toBe(1) // +1

    invSeqSale++
    await deductForSaleInvoice(tx, {
      businessId: BIZ,
      invoiceId: `inv-sale-${invSeqSale}`,
      invoiceNumber: `SI-${invSeqSale}`,
      items: [{ productId: PROD, quantity: 30 }],
      userId: USER,
    })
    expect(movements.length).toBe(2) // +1

    await adjustStock(tx, {
      productId: PROD,
      businessId: BIZ,
      quantity: -5,
      type: 'ADJUSTMENT_OUT',
      reason: 'DAMAGE',
      userId: USER,
    })
    expect(movements.length).toBe(3) // +1

    invSeqPurchase++
    await addForPurchaseInvoice(tx, {
      businessId: BIZ,
      invoiceId: `inv-purchase-${invSeqPurchase}`,
      invoiceNumber: `PO-${invSeqPurchase}`,
      items: [{ productId: PROD, quantity: 50, unitCostPaise: 1300 }],
      userId: USER,
    })
    expect(movements.length).toBe(4) // +1

    invSeqSale++
    const sale2Id = `inv-sale-${invSeqSale}`
    await deductForSaleInvoice(tx, {
      businessId: BIZ,
      invoiceId: sale2Id,
      invoiceNumber: `SI-${invSeqSale}`,
      items: [{ productId: PROD, quantity: 40 }],
      userId: USER,
    })
    expect(movements.length).toBe(5) // +1

    await reverseForInvoice(tx, {
      businessId: BIZ,
      invoiceId: sale2Id,
      userId: USER,
    })
    expect(movements.length).toBe(6) // +1 reversal movement
  })
})
