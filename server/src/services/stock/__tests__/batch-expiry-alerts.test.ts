/**
 * BAT-04 — Batch Expiry Alerts Service Tests
 *
 * 6 cases:
 *   1. Creates EXPIRY_NEAR for a batch within the alert window
 *   2. Creates EXPIRY_PASSED for a batch whose expiry is in the past
 *   3. Idempotent re-run does NOT duplicate (findFirst guard)
 *   4. EXPIRY_PASSED creation auto-resolves a prior EXPIRY_NEAR
 *   5. Zero-stock batches are skipped by the SQL WHERE clause
 *   6. resolveBatchAlerts resolves all ACTIVE expiry alerts inline
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Shared state for mock DB
// ---------------------------------------------------------------------------

let alertIdSeq = 0

function resetState() {
  alertIdSeq = 0
}

function nextId() {
  return `alert-${++alertIdSeq}`
}

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockQueryRaw, mockFindFirst, mockUpdateMany, mockCreate, mockExecuteRaw, mockFindMany } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockFindFirst: vi.fn(),
  mockUpdateMany: vi.fn(),
  mockCreate: vi.fn(),
  mockExecuteRaw: vi.fn(),
  mockFindMany: vi.fn(),
}))

const fakeTxFactory = () => ({
  $queryRaw: mockQueryRaw,
  $executeRaw: mockExecuteRaw,
  stockAlert: {
    findFirst: mockFindFirst,
    updateMany: mockUpdateMany,
    create: mockCreate,
  },
})

vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    business: { findMany: mockFindMany },
    stockAlert: {
      findFirst: mockFindFirst,
      updateMany: mockUpdateMany,
      create: mockCreate,
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(fakeTxFactory())),
    $disconnect: vi.fn(),
  },
}))

vi.mock('../../../lib/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('../../../lib/date.js', () => ({
  istMidnightUtc: vi.fn((d?: Date) => d ?? new Date('2026-05-06T00:00:00Z')),
}))

import { runBatchExpiryAlerts, resolveBatchAlerts } from '../batch-expiry-alerts.service.js'
import { prisma } from '../../../lib/prisma.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BIZ = 'biz-bat-04'
const PROD = 'prod-bat-04'
const BATCH_ID = 'batch-bat-04'
const TODAY = new Date('2026-05-06T00:00:00Z')
const IN_WINDOW = new Date('2026-05-20T00:00:00Z') // 14 days ahead
const PAST = new Date('2026-05-01T00:00:00Z')       // 5 days ago

function resetMocks() {
  mockFindMany.mockReset()
  mockQueryRaw.mockReset()
  mockFindFirst.mockReset()
  mockUpdateMany.mockReset()
  mockCreate.mockReset()
  mockExecuteRaw.mockReset()
  // Restore $transaction implementation after mock resets
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(prisma.$transaction as any).mockImplementation(
    async (fn: (tx: unknown) => unknown) => fn(fakeTxFactory())
  )
}

function seedBusiness(alertDays = 30) {
  mockFindMany
    .mockResolvedValueOnce([{ id: BIZ, expiryAlertDays: alertDays }])
    .mockResolvedValueOnce([]) // second page = empty → stop
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runBatchExpiryAlerts — EXPIRY_NEAR', () => {
  beforeEach(() => {
    resetState()
    resetMocks()
  })

  it('creates EXPIRY_NEAR for a batch within the alert window', async () => {
    seedBusiness(30)

    // Candidate batch: expires in 14 days, in-stock
    mockQueryRaw.mockResolvedValueOnce([{
      id: BATCH_ID,
      productId: PROD,
      batchNumber: 'B001',
      expiryDate: IN_WINDOW,
      currentStock: 50,
      productName: 'Amoxicillin 500mg',
    }])

    // No existing alert
    mockFindFirst.mockResolvedValueOnce(null)
    mockCreate.mockResolvedValueOnce({ id: nextId() })
    mockExecuteRaw.mockResolvedValueOnce(0) // no sold-out alerts

    const result = await runBatchExpiryAlerts({ now: TODAY })

    expect(result.businessesProcessed).toBe(1)
    expect(result.alertsCreated).toBe(1)
    expect(result.alertsResolved).toBe(0)
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        alertType: 'EXPIRY_NEAR',
        batchId: BATCH_ID,
        businessId: BIZ,
        productId: PROD,
      }),
    })
  })
})

describe('runBatchExpiryAlerts — EXPIRY_PASSED', () => {
  beforeEach(() => {
    resetState()
    resetMocks()
  })

  it('creates EXPIRY_PASSED for a batch whose expiry date is in the past', async () => {
    seedBusiness(30)

    mockQueryRaw.mockResolvedValueOnce([{
      id: BATCH_ID,
      productId: PROD,
      batchNumber: 'B002',
      expiryDate: PAST,
      currentStock: 10,
      productName: 'Paracetamol',
    }])

    mockFindFirst.mockResolvedValueOnce(null) // no active EXPIRY_PASSED
    mockUpdateMany.mockResolvedValueOnce({ count: 0 }) // no EXPIRY_NEAR to resolve
    mockCreate.mockResolvedValueOnce({ id: nextId() })
    mockExecuteRaw.mockResolvedValueOnce(0)

    const result = await runBatchExpiryAlerts({ now: TODAY })

    expect(result.alertsCreated).toBe(1)
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ alertType: 'EXPIRY_PASSED' }),
    })
  })

  it('EXPIRY_PASSED creation resolves any open EXPIRY_NEAR for the same batch', async () => {
    seedBusiness(30)

    mockQueryRaw.mockResolvedValueOnce([{
      id: BATCH_ID,
      productId: PROD,
      batchNumber: 'B003',
      expiryDate: PAST,
      currentStock: 10,
      productName: 'Syrup',
    }])

    mockFindFirst.mockResolvedValueOnce(null) // no active EXPIRY_PASSED
    // resolving EXPIRY_NEAR returns count 1
    mockUpdateMany.mockResolvedValueOnce({ count: 1 })
    mockCreate.mockResolvedValueOnce({ id: nextId() })
    mockExecuteRaw.mockResolvedValueOnce(0)

    const result = await runBatchExpiryAlerts({ now: TODAY })

    expect(result.alertsResolved).toBe(1)
    expect(result.alertsCreated).toBe(1)
    // verify EXPIRY_NEAR was resolved
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ alertType: 'EXPIRY_NEAR', status: 'ACTIVE' }),
        data: expect.objectContaining({ status: 'RESOLVED' }),
      })
    )
  })
})

describe('runBatchExpiryAlerts — idempotency', () => {
  beforeEach(() => {
    resetState()
    resetMocks()
  })

  it('does NOT create a duplicate when an ACTIVE alert already exists', async () => {
    seedBusiness(30)

    mockQueryRaw.mockResolvedValueOnce([{
      id: BATCH_ID,
      productId: PROD,
      batchNumber: 'B004',
      expiryDate: IN_WINDOW,
      currentStock: 50,
      productName: 'Ibuprofen',
    }])

    // findFirst returns existing ACTIVE EXPIRY_NEAR → skip creation
    mockFindFirst.mockResolvedValueOnce({ id: 'existing-alert-id' })
    mockExecuteRaw.mockResolvedValueOnce(0)

    const result = await runBatchExpiryAlerts({ now: TODAY })

    expect(result.alertsCreated).toBe(0)
    expect(mockCreate).not.toHaveBeenCalled()
  })
})

describe('runBatchExpiryAlerts — zero-stock skipped', () => {
  beforeEach(() => {
    resetState()
    resetMocks()
  })

  it('skips batches with currentStock = 0 (SQL WHERE filters them out)', async () => {
    seedBusiness(30)

    // SQL returns empty set (0-stock batch filtered by WHERE currentStock > 0)
    mockQueryRaw.mockResolvedValueOnce([])
    mockExecuteRaw.mockResolvedValueOnce(0)

    const result = await runBatchExpiryAlerts({ now: TODAY })

    expect(result.alertsCreated).toBe(0)
    expect(mockCreate).not.toHaveBeenCalled()
  })
})

describe('resolveBatchAlerts — inline auto-resolve', () => {
  beforeEach(() => {
    resetState()
    resetMocks()
  })

  it('resolves all ACTIVE expiry alerts for a given batchId', async () => {
    const fakeTx = {
      stockAlert: {
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
    }

    const count = await resolveBatchAlerts(fakeTx as unknown as Parameters<typeof resolveBatchAlerts>[0], BATCH_ID)

    expect(count).toBe(2)
    expect(fakeTx.stockAlert.updateMany).toHaveBeenCalledWith({
      where: {
        batchId: BATCH_ID,
        status: 'ACTIVE',
        alertType: { in: ['EXPIRY_NEAR', 'EXPIRY_PASSED'] },
      },
      data: {
        status: 'RESOLVED',
        resolvedAt: expect.any(Date),
      },
    })
  })
})
