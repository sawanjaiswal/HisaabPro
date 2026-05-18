/**
 * Epic B PR2 — Document.priceListId cross-tenant isolation + persistence tests
 *
 * Tests the cross-tenant guard in createDocument and updateDocument:
 *  - Rejects priceListId from a different business (security finding 2.1)
 *  - Accepts and persists a valid same-business priceListId
 *  - Accepts null (clear override)
 *  - Accepts omission (undefined — no-op on update)
 *
 * Uses mocked Prisma to avoid DB dependency.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppError } from '../../../lib/errors.js'

// ── Mock prisma ──────────────────────────────────────────────────────────────

const mockPartyFindFirst = vi.fn()
const mockPriceListFindFirst = vi.fn()
const mockDocumentCreate = vi.fn()
const mockDocumentUpdate = vi.fn()
const mockDocumentFindFirst = vi.fn()
const mockDocumentFindUniqueOrThrow = vi.fn()
const mockTaxCategoryFindMany = vi.fn()
const mockBusinessFindUnique = vi.fn()
const mockDocumentSettingsFindUnique = vi.fn()

vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    party: { findFirst: mockPartyFindFirst },
    priceList: { findFirst: mockPriceListFindFirst },
    document: {
      create: mockDocumentCreate,
      findFirst: mockDocumentFindFirst,
      findUniqueOrThrow: mockDocumentFindUniqueOrThrow,
      findFirstOrThrow: mockDocumentFindUniqueOrThrow,
      update: mockDocumentUpdate,
    },
    taxCategory: { findMany: mockTaxCategoryFindMany },
    business: { findUnique: mockBusinessFindUnique },
    documentSettings: { findUnique: mockDocumentSettingsFindUnique },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({
      document: {
        create: mockDocumentCreate,
        findUniqueOrThrow: mockDocumentFindUniqueOrThrow,
        findFirstOrThrow: mockDocumentFindUniqueOrThrow,
        update: mockDocumentUpdate,
      },
      documentLineItem: { createMany: vi.fn(), deleteMany: vi.fn() },
      documentAdditionalCharge: { createMany: vi.fn(), deleteMany: vi.fn() },
      documentCustomFieldValue: { deleteMany: vi.fn(), createMany: vi.fn() },
      taxCategory: { findMany: mockTaxCategoryFindMany },
      business: { findUnique: mockBusinessFindUnique },
      documentSettings: { findUnique: mockDocumentSettingsFindUnique },
      product: { findMany: vi.fn().mockResolvedValue([]) },
      auditLog: { create: vi.fn() },
    })),
  },
}))

vi.mock('../../../lib/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// Stub out heavy dependencies so unit test stays fast
vi.mock('../../stock.service.js', () => ({
  deductForSaleInvoice: vi.fn().mockResolvedValue({ movements: [], warnings: [] }),
  addForPurchaseInvoice: vi.fn().mockResolvedValue([]),
  reverseForInvoice: vi.fn().mockResolvedValue(undefined),
  scheduleAlertChecks: vi.fn(),
}))
vi.mock('../../document-number.service.js', () => ({
  generateNextNumber: vi.fn().mockResolvedValue({ documentNumber: 'INV-001', sequenceNumber: 1, financialYear: '2526' }),
}))
vi.mock('../create-batch-validation.js', () => ({
  validateLineItemProducts: vi.fn().mockResolvedValue({
    products: [], productMap: new Map(), moqWarnings: [],
  }),
}))
vi.mock('../create-audit.js', () => ({ recordFreeItemAudit: vi.fn() }))
vi.mock('../line-item-builder.js', () => ({ buildLineItemData: vi.fn().mockReturnValue([]) }))
vi.mock('../custom-fields.js', () => ({ persistDocumentCustomFieldValues: vi.fn() }))
vi.mock('../../composition.service.js', () => ({ getCompositionInvoiceInfo: vi.fn().mockReturnValue(null) }))
vi.mock('../../notifications/notification-manager.js', () => ({ notificationManager: { notify: vi.fn() } }))
vi.mock('../../notifications/notification-template.service.js', () => ({ formatPaise: vi.fn().mockReturnValue('₹0') }))
vi.mock('../create-tax-prep.js', () => ({
  assertGstEnabled: vi.fn(),
  assertCompositionNoLineTax: vi.fn(),
  assertCompositionNoInterState: vi.fn(),
  buildCalcItems: vi.fn().mockReturnValue([]),
  computeGstTotals: vi.fn().mockReturnValue({
    subtotal: 0, totalDiscount: 0, totalAdditionalCharges: 0, roundOff: 0,
    grandTotal: 0, totalCost: 0, totalProfit: 0, profitPercent: 0,
    totalTaxableValue: 0, totalCgst: 0, totalSgst: 0, totalIgst: 0, totalCess: 0,
  }),
  resolveSupplyType: vi.fn().mockReturnValue('B2B'),
}))
vi.mock('../helpers.js', () => ({
  STOCK_DECREASE_TYPES: new Set(['SALE_INVOICE']),
  STOCK_INCREASE_TYPES: new Set(['PURCHASE_INVOICE']),
  AFFECTS_OUTSTANDING: new Set(['SALE_INVOICE']),
  getRoundOffSetting: vi.fn().mockResolvedValue('NONE'),
  updateOutstanding: vi.fn(),
  getOutstandingDelta: vi.fn().mockReturnValue(0),
  getOutstandingReverseDelta: vi.fn().mockReturnValue(0),
}))
vi.mock('../moq.guard.js', () => ({ assertMoq: vi.fn().mockReturnValue([]) }))

// ── Constants ────────────────────────────────────────────────────────────────

const BIZ_A = 'biz-a'
const LIST_A = 'cm_list_a_0000000000000'  // fake cuid-shaped ID for Biz A
const LIST_B = 'cm_list_b_0000000000000'  // fake cuid-shaped ID for Biz B (cross-tenant)

const BASE_CREATE_INPUT = {
  type: 'SALE_INVOICE' as const,
  status: 'DRAFT' as const,
  partyId: 'party-1',
  documentDate: '2026-05-15',
  lineItems: [{ productId: 'prod-1', quantity: 1, rate: 10000, discountType: 'AMOUNT' as const, discountValue: 0 }],
  additionalCharges: [],
  includeSignature: false,
}

const DOC_STUB = { id: 'doc-1', documentNumber: null, grandTotal: 0, party: { name: 'Test Party' } }

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockPartyFindFirst.mockResolvedValue({ id: 'party-1', gstin: null })
  mockBusinessFindUnique.mockResolvedValue({ stateCode: '27', compositionScheme: false, gstEnabled: false })
  mockDocumentCreate.mockResolvedValue(DOC_STUB)
  mockDocumentFindUniqueOrThrow.mockResolvedValue(DOC_STUB)
  mockDocumentFindFirst.mockResolvedValue({ id: 'doc-1', type: 'SALE_INVOICE', status: 'DRAFT', partyId: 'party-1', grandTotal: 0, placeOfSupply: null, isComposite: false, lineItems: [] })
  mockDocumentUpdate.mockResolvedValue(DOC_STUB)
  mockTaxCategoryFindMany.mockResolvedValue([])
  mockDocumentSettingsFindUnique.mockResolvedValue({ enforceMoq: false })
})

// ── createDocument tests ─────────────────────────────────────────────────────

describe('createDocument — priceListId cross-tenant guard (security 2.1)', () => {
  it('rejects priceListId from a different business', async () => {
    const { createDocument } = await import('../create.js')

    // Biz B's list — findFirst returns null (not found for Biz A)
    mockPriceListFindFirst.mockResolvedValue(null)

    await expect(
      createDocument(BIZ_A, 'user-1', { ...BASE_CREATE_INPUT, priceListId: LIST_B }),
    ).rejects.toSatisfy((err: unknown) => {
      return err instanceof AppError &&
        err.statusCode === 404 &&
        err.message.includes('Price list not found')
    })

    // Guard must scope by businessId
    expect(mockPriceListFindFirst).toHaveBeenCalledWith({
      where: { id: LIST_B, businessId: BIZ_A, isDeleted: false },
      select: { id: true },
    })
  })

  it('persists priceListId when it belongs to the same business', async () => {
    const { createDocument } = await import('../create.js')

    mockPriceListFindFirst.mockResolvedValue({ id: LIST_A })

    await createDocument(BIZ_A, 'user-1', { ...BASE_CREATE_INPUT, priceListId: LIST_A })

    expect(mockDocumentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ priceListId: LIST_A }),
      }),
    )
  })

  it('accepts null (explicit clear of override)', async () => {
    const { createDocument } = await import('../create.js')

    // priceListId = null — guard block must not run (no findFirst call)
    await createDocument(BIZ_A, 'user-1', { ...BASE_CREATE_INPUT, priceListId: null })

    expect(mockPriceListFindFirst).not.toHaveBeenCalled()
    expect(mockDocumentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ priceListId: null }),
      }),
    )
  })

  it('accepts omission (priceListId undefined — defaults to null)', async () => {
    const { createDocument } = await import('../create.js')

    await createDocument(BIZ_A, 'user-1', { ...BASE_CREATE_INPUT })

    expect(mockPriceListFindFirst).not.toHaveBeenCalled()
    expect(mockDocumentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ priceListId: null }),
      }),
    )
  })
})

// ── updateDocument tests ─────────────────────────────────────────────────────

describe('updateDocument — priceListId cross-tenant guard (security 2.1)', () => {
  it('rejects priceListId from a different business on update', async () => {
    const { updateDocument } = await import('../update.js')

    mockPriceListFindFirst.mockResolvedValue(null)

    await expect(
      updateDocument(BIZ_A, 'doc-1', 'user-1', { priceListId: LIST_B }),
    ).rejects.toSatisfy((err: unknown) => {
      return err instanceof AppError &&
        err.statusCode === 404 &&
        err.message.includes('Price list not found')
    })
  })

  it('persists priceListId on update when owned by same business', async () => {
    const { updateDocument } = await import('../update.js')

    mockPriceListFindFirst.mockResolvedValue({ id: LIST_A })

    await updateDocument(BIZ_A, 'doc-1', 'user-1', { priceListId: LIST_A })

    expect(mockDocumentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ priceListId: LIST_A }),
      }),
    )
  })

  it('accepts null on update (clears override)', async () => {
    const { updateDocument } = await import('../update.js')

    await updateDocument(BIZ_A, 'doc-1', 'user-1', { priceListId: null })

    expect(mockPriceListFindFirst).not.toHaveBeenCalled()
    expect(mockDocumentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ priceListId: null }),
      }),
    )
  })

  it('leaves priceListId unchanged when not sent (undefined)', async () => {
    const { updateDocument } = await import('../update.js')

    await updateDocument(BIZ_A, 'doc-1', 'user-1', { notes: 'updated' })

    expect(mockPriceListFindFirst).not.toHaveBeenCalled()
    // updateData must NOT contain priceListId key
    const updateCall = mockDocumentUpdate.mock.calls[0]
    expect(updateCall[0].data).not.toHaveProperty('priceListId')
  })
})
