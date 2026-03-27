/**
 * Product Routes — Integration Tests
 * Tests CRUD, stock adjust, stock movements, stock validation, barcode lookup.
 * Services are mocked; auth/permission middleware use mocked Prisma.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createApp } from '../app.js'
import {
  authAgent,
  anonAgent,
  mockOwnerPermission,
  mockStaffPermission,
  resetMocks,
  TEST_USER,
} from './helpers.js'

// ─── Service Mocks ──────────────────────────────────────────────────────────

vi.mock('../services/product.service.js', () => ({
  createProduct: vi.fn(),
  listProducts: vi.fn(),
  getProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
  findByBarcode: vi.fn(),
  listStockMovements: vi.fn(),
  listStockHistory: vi.fn(),
  bulkAdjustStock: vi.fn(),
}))

vi.mock('../services/stock.service.js', () => ({
  adjustStock: vi.fn(),
  validateStockForInvoice: vi.fn(),
  scheduleAlertChecks: vi.fn(),
}))

vi.mock('../services/product-bulk.service.js', () => ({
  bulkImportProducts: vi.fn(),
  exportProducts: vi.fn(),
  getReorderList: vi.fn(),
}))

vi.mock('../services/stock-alert.service.js', () => ({
  checkAndCreateAlerts: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../middleware/idempotency.js', () => ({
  idempotencyCheck: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}))

import * as productService from '../services/product.service.js'
import * as stockService from '../services/stock.service.js'

const app = createApp()

// ─── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_PRODUCT = {
  id: 'prod-1',
  name: 'Rice 5kg',
  sku: 'RICE-001',
  salePrice: 25000,
  purchasePrice: 20000,
  currentStock: 100,
  unit: 'BAG',
  businessId: TEST_USER.businessId,
}

const CREATE_BODY = {
  name: 'Rice 5kg',
  unitId: 'unit-1',
  salePrice: 25000,
}

// ─── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetMocks()
  vi.mocked(productService.createProduct).mockReset()
  vi.mocked(productService.listProducts).mockReset()
  vi.mocked(productService.getProduct).mockReset()
  vi.mocked(productService.updateProduct).mockReset()
  vi.mocked(productService.deleteProduct).mockReset()
  vi.mocked(productService.findByBarcode).mockReset()
  vi.mocked(productService.listStockMovements).mockReset()
  vi.mocked(stockService.adjustStock).mockReset()
  vi.mocked(stockService.validateStockForInvoice).mockReset()
})

// ─── POST /api/products ─────────────────────────────────────────────────────

describe('POST /api/products', () => {
  it('should create a product (201, owner)', async () => {
    mockOwnerPermission()
    vi.mocked(productService.createProduct).mockResolvedValue(MOCK_PRODUCT as never)

    const res = await authAgent(app)
      .post('/api/products')
      .send(CREATE_BODY)

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.product).toEqual(MOCK_PRODUCT)
    expect(productService.createProduct).toHaveBeenCalledWith(
      TEST_USER.businessId,
      TEST_USER.userId,
      expect.objectContaining({ name: 'Rice 5kg', salePrice: 25000 })
    )
  })

  it('should return 401 without auth', async () => {
    const res = await anonAgent(app)
      .post('/api/products')
      .send(CREATE_BODY)

    expect(res.status).toBe(401)
    expect(productService.createProduct).not.toHaveBeenCalled()
  })

  it('should return 403 without inventory.create permission', async () => {
    mockStaffPermission(['inventory.view'])

    const res = await authAgent(app)
      .post('/api/products')
      .send(CREATE_BODY)

    expect(res.status).toBe(403)
    expect(productService.createProduct).not.toHaveBeenCalled()
  })

  it('should return 400 when name is missing', async () => {
    mockOwnerPermission()

    const res = await authAgent(app)
      .post('/api/products')
      .send({ unitId: 'unit-1', salePrice: 25000 })

    expect(res.status).toBe(400)
    expect(productService.createProduct).not.toHaveBeenCalled()
  })
})

// ─── GET /api/products ──────────────────────────────────────────────────────

describe('GET /api/products', () => {
  it('should list products with pagination', async () => {
    mockOwnerPermission()
    const mockResult = {
      products: [MOCK_PRODUCT],
      total: 1,
      page: 1,
      limit: 20,
    }
    vi.mocked(productService.listProducts).mockResolvedValue(mockResult as never)

    const res = await authAgent(app).get('/api/products')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.products).toHaveLength(1)
    expect(productService.listProducts).toHaveBeenCalledWith(
      TEST_USER.businessId,
      expect.objectContaining({ page: 1, limit: 20 })
    )
  })
})

// ─── GET /api/products/:id ──────────────────────────────────────────────────

describe('GET /api/products/:id', () => {
  it('should return a single product', async () => {
    mockOwnerPermission()
    vi.mocked(productService.getProduct).mockResolvedValue(MOCK_PRODUCT as never)

    const res = await authAgent(app).get('/api/products/prod-1')

    expect(res.status).toBe(200)
    expect(res.body.data.product).toEqual(MOCK_PRODUCT)
    expect(productService.getProduct).toHaveBeenCalledWith(
      TEST_USER.businessId,
      'prod-1'
    )
  })
})

// ─── PUT /api/products/:id ──────────────────────────────────────────────────

describe('PUT /api/products/:id', () => {
  it('should update a product', async () => {
    mockOwnerPermission()
    const updated = { ...MOCK_PRODUCT, name: 'Rice 10kg' }
    vi.mocked(productService.updateProduct).mockResolvedValue(updated as never)

    const res = await authAgent(app)
      .put('/api/products/prod-1')
      .send({ name: 'Rice 10kg' })

    expect(res.status).toBe(200)
    expect(res.body.data.product.name).toBe('Rice 10kg')
    expect(productService.updateProduct).toHaveBeenCalledWith(
      TEST_USER.businessId,
      'prod-1',
      expect.objectContaining({ name: 'Rice 10kg' })
    )
  })
})

// ─── DELETE /api/products/:id ───────────────────────────────────────────────

describe('DELETE /api/products/:id', () => {
  it('should delete a product', async () => {
    mockOwnerPermission()
    vi.mocked(productService.deleteProduct).mockResolvedValue({ deleted: true } as never)

    const res = await authAgent(app).delete('/api/products/prod-1')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(productService.deleteProduct).toHaveBeenCalledWith(
      TEST_USER.businessId,
      'prod-1'
    )
  })
})

// ─── POST /api/products/:id/stock/adjust ────────────────────────────────────

describe('POST /api/products/:id/stock/adjust', () => {
  it('should adjust stock (owner)', async () => {
    mockOwnerPermission()
    vi.mocked(stockService.adjustStock).mockResolvedValue({
      movement: { id: 'mov-1', type: 'ADJUSTMENT_IN', quantity: 10 },
      newStock: 110,
      previousStock: 100,
    } as never)

    const res = await authAgent(app)
      .post('/api/products/prod-1/stock/adjust')
      .send({
        type: 'ADJUSTMENT_IN',
        quantity: 10,
        reason: 'AUDIT',
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.product.currentStock).toBe(110)
  })
})

// ─── GET /api/products/:id/stock/movements ──────────────────────────────────

describe('GET /api/products/:id/stock/movements', () => {
  it('should return stock movement history', async () => {
    mockOwnerPermission()
    const mockResult = {
      movements: [{ id: 'mov-1', type: 'ADJUSTMENT_IN', quantity: 10 }],
      total: 1,
      page: 1,
      limit: 20,
    }
    vi.mocked(productService.listStockMovements).mockResolvedValue(mockResult as never)

    const res = await authAgent(app).get('/api/products/prod-1/stock/movements')

    expect(res.status).toBe(200)
    expect(res.body.data.movements).toHaveLength(1)
    expect(productService.listStockMovements).toHaveBeenCalledWith(
      TEST_USER.businessId,
      'prod-1',
      expect.objectContaining({ page: 1, limit: 20 })
    )
  })
})

// ─── POST /api/products/stock/validate ──────────────────────────────────────

describe('POST /api/products/stock/validate', () => {
  it('should validate stock for invoice items', async () => {
    mockOwnerPermission()
    vi.mocked(stockService.validateStockForInvoice).mockResolvedValue({
      valid: true,
      items: [{ productId: 'prod-1', available: 100, requested: 5, sufficient: true }],
    } as never)

    const res = await authAgent(app)
      .post('/api/products/stock/validate')
      .send({
        items: [{ productId: 'prod-1', quantity: 5, unitId: 'unit-1' }],
      })

    expect(res.status).toBe(200)
    expect(res.body.data.valid).toBe(true)
    expect(stockService.validateStockForInvoice).toHaveBeenCalledWith(
      TEST_USER.businessId,
      [{ productId: 'prod-1', quantity: 5, unitId: 'unit-1' }]
    )
  })
})

// ─── GET /api/products/by-barcode/:code ─────────────────────────────────────

describe('GET /api/products/by-barcode/:code', () => {
  it('should find a product by barcode', async () => {
    mockOwnerPermission()
    vi.mocked(productService.findByBarcode).mockResolvedValue(MOCK_PRODUCT as never)

    const res = await authAgent(app).get('/api/products/by-barcode/8901234567890')

    expect(res.status).toBe(200)
    expect(res.body.data.product).toEqual(MOCK_PRODUCT)
    expect(productService.findByBarcode).toHaveBeenCalledWith(
      TEST_USER.businessId,
      '8901234567890'
    )
  })
})
