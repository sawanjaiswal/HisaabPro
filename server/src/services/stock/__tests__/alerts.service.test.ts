/**
 * INV-04 — Reorder Alerts Service Tests
 *
 * Tests checkAndCreateAlerts / evaluateAlertsForProducts:
 *   - Triggers alert when currentStock <= minStockLevel (minLevel > 0)
 *   - Triggers alert when currentStock <= reorderQty (even if minLevel not breached)
 *   - Only one ACTIVE alert per product (no duplicate creation)
 *   - Resolves open alert when stock recovers above both thresholds
 *   - OUT_OF_STOCK alert type when stock <= 0
 *   - evaluateAlertsForProducts batches correctly
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks (vi.mock is hoisted before imports) ────────────────────────

const {
  mockProduct,
  mockInventorySetting,
  mockAlertFindFirst,
  mockAlertUpdate,
  mockAlertUpdateMany,
  mockAlertCreate,
} = vi.hoisted(() => ({
  mockProduct: vi.fn(),
  mockInventorySetting: vi.fn(),
  mockAlertFindFirst: vi.fn(),
  mockAlertUpdate: vi.fn(),
  mockAlertUpdateMany: vi.fn(),
  mockAlertCreate: vi.fn(),
}))

vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    product: { findUnique: mockProduct },
    inventorySetting: { findUnique: mockInventorySetting },
    stockAlert: {
      findFirst: mockAlertFindFirst,
      update: mockAlertUpdate,
      updateMany: mockAlertUpdateMany,
      create: mockAlertCreate,
    },
    businessUser: { findFirst: vi.fn().mockResolvedValue(null) },
    notification: { create: vi.fn() },
    notificationPreference: { findUnique: vi.fn() },
  },
}))

vi.mock('../../notifications/notification-manager.js', () => ({
  notificationManager: { notify: vi.fn().mockResolvedValue(undefined) },
}))

vi.mock('../../../lib/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { checkAndCreateAlerts, evaluateAlertsForProducts } from '../../stock-alert.service.js'

// ── Helpers ─────────────────────────────────────────────────────────────────

const BIZ = 'biz-1'
const PROD = 'prod-1'

function mockProductData(
  currentStock: number,
  minStockLevel: number,
  reorderQty: number | null = null
) {
  mockProduct.mockResolvedValue({ id: PROD, name: 'Rice 5kg', currentStock, minStockLevel, reorderQty })
}

function mockSettingEnabled(enabled = true) {
  mockInventorySetting.mockResolvedValue({ lowStockAlertEnabled: enabled })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAlertFindFirst.mockResolvedValue(null)
  mockAlertCreate.mockResolvedValue({ id: 'alert-1' })
  mockAlertUpdate.mockResolvedValue({ id: 'alert-1' })
  mockAlertUpdateMany.mockResolvedValue({ count: 0 })
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('checkAndCreateAlerts — minStockLevel threshold', () => {
  it('creates LOW_STOCK alert when stock <= minStockLevel', async () => {
    mockProductData(3, 5) // stock 3, min 5
    mockSettingEnabled()
    await checkAndCreateAlerts(BIZ, PROD)
    expect(mockAlertCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ alertType: 'LOW_STOCK', productId: PROD, businessId: BIZ }),
    }))
  })

  it('does not create alert when stock > minStockLevel and reorderQty null', async () => {
    mockProductData(10, 5) // stock 10, min 5 — above threshold
    mockSettingEnabled()
    await checkAndCreateAlerts(BIZ, PROD)
    expect(mockAlertCreate).not.toHaveBeenCalled()
    // Should attempt to resolve existing alerts
    expect(mockAlertUpdateMany).toHaveBeenCalled()
  })

  it('creates OUT_OF_STOCK alert when stock <= 0', async () => {
    mockProductData(0, 5)
    mockSettingEnabled()
    await checkAndCreateAlerts(BIZ, PROD)
    expect(mockAlertCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ alertType: 'OUT_OF_STOCK' }),
    }))
  })
})

describe('checkAndCreateAlerts — reorderQty threshold', () => {
  it('creates alert when stock <= reorderQty even if minStockLevel not breached', async () => {
    // minStockLevel = 2 (not breached), reorderQty = 10, stock = 8
    mockProductData(8, 2, 10)
    mockSettingEnabled()
    await checkAndCreateAlerts(BIZ, PROD)
    // reorderQty breached (8 <= 10) → alert created
    expect(mockAlertCreate).toHaveBeenCalled()
  })

  it('uses higher of the two thresholds as representative threshold', async () => {
    mockProductData(3, 5, 10) // min=5, reorder=10, stock=3 — both breached
    mockSettingEnabled()
    await checkAndCreateAlerts(BIZ, PROD)
    expect(mockAlertCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ threshold: 10 }), // max(5, 10) = 10
    }))
  })

  it('does not create alert when stock above both thresholds', async () => {
    mockProductData(15, 5, 10) // stock 15 > both
    mockSettingEnabled()
    await checkAndCreateAlerts(BIZ, PROD)
    expect(mockAlertCreate).not.toHaveBeenCalled()
  })
})

describe('checkAndCreateAlerts — duplicate prevention', () => {
  it('updates existing ACTIVE alert instead of creating a duplicate', async () => {
    mockProductData(3, 5)
    mockSettingEnabled()
    mockAlertFindFirst.mockResolvedValue({ id: 'existing-alert' })

    await checkAndCreateAlerts(BIZ, PROD)

    expect(mockAlertCreate).not.toHaveBeenCalled()
    expect(mockAlertUpdate).toHaveBeenCalledWith({
      where: { id: 'existing-alert' },
      data: { currentQty: 3 },
    })
  })
})

describe('checkAndCreateAlerts — alert resolution', () => {
  it('resolves active alerts when stock recovers above thresholds', async () => {
    mockProductData(20, 5, 10) // stock 20 — above both
    mockSettingEnabled()
    mockAlertUpdateMany.mockResolvedValue({ count: 1 })

    await checkAndCreateAlerts(BIZ, PROD)

    expect(mockAlertUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { in: ['ACTIVE', 'ACKNOWLEDGED'] } }),
        data: expect.objectContaining({ status: 'RESOLVED' }),
      })
    )
    expect(mockAlertCreate).not.toHaveBeenCalled()
  })
})

describe('checkAndCreateAlerts — settings guard', () => {
  it('skips alert creation when lowStockAlertEnabled=false', async () => {
    mockProductData(1, 5)
    mockSettingEnabled(false)
    await checkAndCreateAlerts(BIZ, PROD)
    expect(mockAlertCreate).not.toHaveBeenCalled()
  })

  it('skips when product not found', async () => {
    mockProduct.mockResolvedValue(null)
    mockSettingEnabled()
    await checkAndCreateAlerts(BIZ, PROD)
    expect(mockAlertCreate).not.toHaveBeenCalled()
  })
})

describe('evaluateAlertsForProducts', () => {
  it('deduplicates product IDs before evaluating', async () => {
    mockProductData(3, 5)
    mockSettingEnabled()
    await evaluateAlertsForProducts(BIZ, [PROD, PROD, PROD])
    // product.findUnique should be called once (deduped)
    expect(mockProduct).toHaveBeenCalledTimes(1)
  })

  it('continues evaluating remaining products when one fails', async () => {
    mockProduct
      .mockRejectedValueOnce(new Error('DB timeout'))
      .mockResolvedValueOnce({
        id: 'prod-2',
        name: 'Sugar',
        currentStock: 2,
        minStockLevel: 5,
        reorderQty: null,
      })
    mockSettingEnabled()
    mockAlertFindFirst.mockResolvedValue(null)

    // Should not throw
    await expect(
      evaluateAlertsForProducts(BIZ, [PROD, 'prod-2'])
    ).resolves.not.toThrow()

    // Second product should still create an alert
    expect(mockAlertCreate).toHaveBeenCalledTimes(1)
  })
})
