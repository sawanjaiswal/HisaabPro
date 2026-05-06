/**
 * INV-02 — Sale Decrement + HARD_BLOCK Tests
 *
 * Tests the deductForSaleInvoice function in isolation using mocked
 * Prisma tx client. Covers:
 *   - Sale decrements stock on SAVE
 *   - HARD_BLOCK rejects oversell with 409-shaped error (all items, not just first)
 *   - WARN_ONLY allows negative stock
 *   - Concurrent-safe: row-lock inside adjustStock prevents overshooting
 *   - Void/delete reversal via reverseForInvoice
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { deductForSaleInvoice, reverseForInvoice } from '../../stock/invoice-ops.js'
import { AppError, ErrorCode } from '../../../lib/errors.js'

// ── Mock prisma module ──────────────────────────────────────────────────────

vi.mock('../../../lib/prisma.js', () => {
  const mockPrisma = {
    product: { update: vi.fn() },
    stockMovement: { create: vi.fn(), findMany: vi.fn() },
    inventorySetting: { findUnique: vi.fn() },
    $queryRaw: vi.fn(),
    $transaction: vi.fn((fn: unknown) => typeof fn === 'function' ? fn(mockPrisma) : Promise.resolve(fn)),
  }
  return { prisma: mockPrisma }
})

vi.mock('../../../lib/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('../../stock-alert.service.js', () => ({
  checkAndCreateAlerts: vi.fn().mockResolvedValue(undefined),
}))

// ── Helpers ─────────────────────────────────────────────────────────────────

const BIZ = 'biz-1'
const INV = 'inv-1'
const INV_NUM = 'INV-001'
const USER = 'user-1'

const PROD_A = 'prod-a'
const PROD_B = 'prod-b'
const PROD_C = 'prod-c'

/** Build a minimal tx mock for a given scenario */
function buildTx({
  businessMode = 'HARD_BLOCK',
  stockMap = {} as Record<string, { current: number; name: string }>,
}: {
  businessMode?: 'WARN_ONLY' | 'HARD_BLOCK'
  stockMap?: Record<string, { current: number; name: string }>
}) {
  const stockState = { ...stockMap }

  const tx = {
    inventorySetting: {
      findUnique: vi.fn().mockResolvedValue({ stockValidationMode: businessMode }),
    },
    $queryRaw: vi.fn().mockImplementation((_strings: TemplateStringsArray, productId: string) => {
      const s = stockState[productId]
      if (!s) return Promise.resolve([])
      return Promise.resolve([{
        id: productId,
        name: s.name,
        current_stock: s.current,
        stock_validation: 'GLOBAL',
        business_id: BIZ,
      }])
    }),
    product: {
      update: vi.fn().mockImplementation(({ where, data }: { where: { id: string }; data: { currentStock: number } }) => {
        if (stockState[where.id]) {
          stockState[where.id].current = data.currentStock
        }
        return Promise.resolve({})
      }),
    },
    stockMovement: {
      create: vi.fn().mockImplementation(({ data }: { data: { productId: string; quantity: number; balanceAfter: number } }) => {
        return Promise.resolve({
          id: `mov-${data.productId}`,
          productId: data.productId,
          type: data.quantity < 0 ? 'SALE' : 'REVERSAL',
          quantity: data.quantity,
          balanceAfter: data.balanceAfter,
          reason: null,
          customReason: null,
          notes: null,
          referenceType: 'SALE_INVOICE',
          referenceId: INV,
          referenceNumber: INV_NUM,
          movementDate: new Date(),
          createdBy: USER,
          createdAt: new Date(),
        })
      }),
      findMany: vi.fn().mockImplementation(() => {
        return Promise.resolve(
          Object.entries(stockMap).map(([productId]) => ({
            productId,
            quantity: -5, // original deduction
          }))
        )
      }),
    },
  }
  return { tx, stockState }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('deductForSaleInvoice', () => {
  beforeEach(() => vi.clearAllMocks())

  it('decrements stock correctly on sale save', async () => {
    const { tx, stockState } = buildTx({
      businessMode: 'HARD_BLOCK',
      stockMap: { [PROD_A]: { current: 20, name: 'Rice' } },
    })

    const movements = await deductForSaleInvoice(tx as never, {
      businessId: BIZ,
      invoiceId: INV,
      invoiceNumber: INV_NUM,
      items: [{ productId: PROD_A, quantity: 5 }],
      userId: USER,
    })

    expect(movements).toHaveLength(1)
    expect(movements[0].quantity).toBe(-5)
    expect(movements[0].balanceAfter).toBe(15)
    expect(stockState[PROD_A].current).toBe(15)
  })

  it('HARD_BLOCK: throws STOCK_SHORTAGE with ALL insufficient items (not just first)', async () => {
    const { tx } = buildTx({
      businessMode: 'HARD_BLOCK',
      stockMap: {
        [PROD_A]: { current: 10, name: 'Sugar' },  // OK (request 5)
        [PROD_B]: { current: 3, name: 'Salt' },    // SHORT (request 8)
        [PROD_C]: { current: 1, name: 'Oil' },     // SHORT (request 6)
      },
    })

    const items = [
      { productId: PROD_A, quantity: 5 },
      { productId: PROD_B, quantity: 8 },
      { productId: PROD_C, quantity: 6 },
    ]

    let caught: unknown
    try {
      await deductForSaleInvoice(tx as never, {
        businessId: BIZ, invoiceId: INV, invoiceNumber: INV_NUM, items, userId: USER,
      })
    } catch (e) {
      caught = e
    }

    expect(caught).toBeInstanceOf(AppError)
    const err = caught as AppError
    expect(err.code).toBe(ErrorCode.STOCK_SHORTAGE)
    expect(err.statusCode).toBe(409)

    const detail = err.details as { items: Array<{ productId: string; available: number; requested: number }> }
    // Both PROD_B and PROD_C must appear — not just the first one encountered
    expect(detail.items).toHaveLength(2)
    const ids = detail.items.map(i => i.productId)
    expect(ids).toContain(PROD_B)
    expect(ids).toContain(PROD_C)
    expect(ids).not.toContain(PROD_A)

    // Verify no stock was actually written (transaction aborted before phase 2)
    expect(tx.product.update).not.toHaveBeenCalled()
  })

  it('WARN_ONLY: allows sale that pushes stock negative', async () => {
    const { tx, stockState } = buildTx({
      businessMode: 'WARN_ONLY',
      stockMap: { [PROD_A]: { current: 2, name: 'Milk' } },
    })

    const movements = await deductForSaleInvoice(tx as never, {
      businessId: BIZ,
      invoiceId: INV,
      invoiceNumber: INV_NUM,
      items: [{ productId: PROD_A, quantity: 10 }],
      userId: USER,
    })

    expect(movements).toHaveLength(1)
    expect(movements[0].balanceAfter).toBe(-8)
    expect(stockState[PROD_A].current).toBe(-8)
  })

  it('HARD_BLOCK: does not throw when every item has sufficient stock', async () => {
    const { tx } = buildTx({
      businessMode: 'HARD_BLOCK',
      stockMap: {
        [PROD_A]: { current: 100, name: 'Wheat' },
        [PROD_B]: { current: 50, name: 'Flour' },
      },
    })

    const movements = await deductForSaleInvoice(tx as never, {
      businessId: BIZ,
      invoiceId: INV,
      invoiceNumber: INV_NUM,
      items: [
        { productId: PROD_A, quantity: 10 },
        { productId: PROD_B, quantity: 5 },
      ],
      userId: USER,
    })

    expect(movements).toHaveLength(2)
  })

  it('concurrent sales: sequential FOR UPDATE locking prevents overshooting under HARD_BLOCK', async () => {
    // Simulate 5 concurrent sales of qty 3 each against stock of 12.
    // With FOR UPDATE locking, only 4 should succeed (4 * 3 = 12), the 5th should throw.
    // In this unit test we simulate the serialized lock behavior via a shared counter.
    let sharedStock = 12
    const QUANTITY = 3

    function buildSerializedTx() {
      return {
        inventorySetting: {
          findUnique: vi.fn().mockResolvedValue({ stockValidationMode: 'HARD_BLOCK' }),
        },
        $queryRaw: vi.fn().mockImplementation(() => {
          return Promise.resolve([{
            id: PROD_A,
            name: 'Widget',
            current_stock: sharedStock, // read current (simulates FOR UPDATE snapshot)
            stock_validation: 'GLOBAL',
            business_id: BIZ,
          }])
        }),
        product: {
          update: vi.fn().mockImplementation(({ data }: { data: { currentStock: number } }) => {
            sharedStock = data.currentStock
            return Promise.resolve({})
          }),
        },
        stockMovement: {
          create: vi.fn().mockImplementation(({ data }: { data: { productId: string; quantity: number; balanceAfter: number } }) =>
            Promise.resolve({ id: 'mov', productId: data.productId, type: 'SALE', quantity: data.quantity, balanceAfter: data.balanceAfter, reason: null, customReason: null, notes: null, referenceType: null, referenceId: null, referenceNumber: null, movementDate: new Date(), createdBy: USER, createdAt: new Date() })
          ),
        },
      }
    }

    let succeeded = 0
    let blocked = 0

    // Fire 5 sequential calls (in a real DB they'd serialize via FOR UPDATE)
    for (let i = 0; i < 5; i++) {
      const t = buildSerializedTx()
      try {
        await deductForSaleInvoice(t as never, {
          businessId: BIZ, invoiceId: `inv-${i}`, invoiceNumber: `INV-00${i}`,
          items: [{ productId: PROD_A, quantity: QUANTITY }],
          userId: USER,
        })
        succeeded++
      } catch (e) {
        if (e instanceof AppError && e.code === ErrorCode.STOCK_SHORTAGE) blocked++
        else throw e
      }
    }

    expect(succeeded).toBe(4)
    expect(blocked).toBe(1)
    expect(sharedStock).toBe(0) // exactly depleted, never negative
  })
})

describe('reverseForInvoice (void/delete)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates REVERSAL movements that restore stock exactly', async () => {
    const stockState: Record<string, { current: number; name: string }> = { [PROD_A]: { current: 15, name: 'Tea' } }

    const tx = {
      stockMovement: {
        findMany: vi.fn().mockResolvedValue([
          { productId: PROD_A, quantity: -5 }, // original SALE deduction
        ]),
        create: vi.fn().mockImplementation(({ data }: { data: { productId: string; quantity: number; balanceAfter: number } }) =>
          Promise.resolve({ id: 'mov-rev', productId: data.productId, type: 'REVERSAL', quantity: data.quantity, balanceAfter: data.balanceAfter, reason: null, customReason: null, notes: null, referenceType: null, referenceId: null, referenceNumber: null, movementDate: new Date(), createdBy: USER, createdAt: new Date() })
        ),
      },
      inventorySetting: {
        findUnique: vi.fn().mockResolvedValue({ stockValidationMode: 'HARD_BLOCK' }),
      },
      $queryRaw: vi.fn().mockImplementation(() =>
        Promise.resolve([{
          id: PROD_A, name: 'Tea',
          current_stock: stockState[PROD_A].current,
          stock_validation: 'GLOBAL',
          business_id: BIZ,
        }])
      ),
      product: {
        update: vi.fn().mockImplementation(({ where, data }: { where: { id: string }; data: { currentStock: number } }) => {
          stockState[where.id].current = data.currentStock
          return Promise.resolve({})
        }),
      },
    }

    const reversals = await reverseForInvoice(tx as never, {
      businessId: BIZ, invoiceId: INV, userId: USER,
    })

    expect(reversals).toHaveLength(1)
    expect(reversals[0].quantity).toBe(5)  // +5 reverses the -5 sale
    expect(stockState[PROD_A].current).toBe(20) // restored: 15 + 5 = 20
  })
})
