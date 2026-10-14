import { describe, it, expect } from 'vitest'
import { validateBulkRow, rowToFormData } from '../bulk-product.service'
import { parsePastedProductText } from '../bulk-product-parser'
import type { BulkProductRow } from '../bulk-product.types'
import type { Unit, Category } from '../../product.types'

const MOCK_UNITS: Unit[] = [
  { id: 'u-pcs', name: 'Pieces', symbol: 'PCS', type: 'PREDEFINED', category: 'COUNT', decimalAllowed: false, baseUnitId: null, baseUnitFactor: null, baseUnit: null, productCount: 0 },
  { id: 'u-kg', name: 'Kilograms', symbol: 'KG', type: 'PREDEFINED', category: 'WEIGHT', decimalAllowed: true, baseUnitId: null, baseUnitFactor: null, baseUnit: null, productCount: 0 },
  { id: 'u-box', name: 'Boxes', symbol: 'BOX', type: 'PREDEFINED', category: 'PACKAGING', decimalAllowed: false, baseUnitId: null, baseUnitFactor: null, baseUnit: null, productCount: 0 },
]

const MOCK_CATEGORIES: Category[] = [
  { id: 'c-dairy', name: 'Dairy', type: 'CUSTOM', color: '#10b981', productCount: 5, sortOrder: 0 },
  { id: 'c-bev', name: 'Beverages', type: 'CUSTOM', color: '#3b82f6', productCount: 2, sortOrder: 1 },
]

describe('Bulk Product - Validation & Conversion', () => {
  it('rejects row with empty name', () => {
    const row: BulkProductRow = {
      id: '1',
      name: '',
      unitId: 'u-pcs',
      salePrice: '100',
      purchasePrice: '80',
      openingStock: '10',
      minStockLevel: '2',
    }
    const { isValid, errors } = validateBulkRow(row)
    expect(isValid).toBe(false)
    expect(errors.name).toBe('Product name is required')
  })

  it('rejects row with missing unit', () => {
    const row: BulkProductRow = {
      id: '1',
      name: 'Amul Butter',
      unitId: '',
      salePrice: '50',
      purchasePrice: '',
      openingStock: '0',
      minStockLevel: '0',
    }
    const { isValid, errors } = validateBulkRow(row)
    expect(isValid).toBe(false)
    expect(errors.unitId).toBe('Unit is required')
  })

  it('rejects negative sale price', () => {
    const row: BulkProductRow = {
      id: '1',
      name: 'Item A',
      unitId: 'u-pcs',
      salePrice: '-10',
      purchasePrice: '5',
      openingStock: '0',
      minStockLevel: '0',
    }
    const { isValid, errors } = validateBulkRow(row)
    expect(isValid).toBe(false)
    expect(errors.salePrice).toBe('Valid sale price is required')
  })

  it('accepts valid product row', () => {
    const row: BulkProductRow = {
      id: '1',
      name: 'Amul Taza 500ml',
      unitId: 'u-pcs',
      salePrice: '32.50',
      purchasePrice: '28.00',
      openingStock: '50',
      minStockLevel: '5',
    }
    const { isValid, errors } = validateBulkRow(row)
    expect(isValid).toBe(true)
    expect(errors).toEqual({})
  })

  it('converts rupee strings to integer paise in rowToFormData', () => {
    const row: BulkProductRow = {
      id: '1',
      name: 'Paneer 200g',
      unitId: 'u-pcs',
      salePrice: '95.50',
      purchasePrice: '75.25',
      openingStock: '20',
      minStockLevel: '5',
      sku: 'PAN-001',
    }
    const formData = rowToFormData(row)
    expect(formData.name).toBe('Paneer 200g')
    expect(formData.salePrice).toBe(9550) // 95.50 * 100 paise
    expect(formData.purchasePrice).toBe(7525) // 75.25 * 100 paise
    expect(formData.openingStock).toBe(20)
    expect(formData.minStockLevel).toBe(5)
    expect(formData.sku).toBe('PAN-001')
    expect(formData.autoGenerateSku).toBe(false)
  })
})

describe('Bulk Product - Clipboard Parser', () => {
  it('parses tab-separated data copied from Excel with headers', () => {
    const tsvData = [
      'Product Name\tUnit\tSale Price\tPurchase Price\tStock\tCategory',
      'Masala Chai 100g\tPCS\t₹150.00\t₹110.00\t25\tBeverages',
      'Fresh Milk 1L\tPCS\t₹65.00\t₹55.00\t40\tDairy',
    ].join('\n')

    const rows = parsePastedProductText(tsvData, MOCK_UNITS, MOCK_CATEGORIES, 'u-pcs')
    expect(rows).toHaveLength(2)

    expect(rows[0].name).toBe('Masala Chai 100g')
    expect(rows[0].unitId).toBe('u-pcs')
    expect(rows[0].salePrice).toBe('150')
    expect(rows[0].purchasePrice).toBe('110')
    expect(rows[0].openingStock).toBe('25')
    expect(rows[0].categoryId).toBe('c-bev')

    expect(rows[1].name).toBe('Fresh Milk 1L')
    expect(rows[1].salePrice).toBe('65')
    expect(rows[1].purchasePrice).toBe('55')
    expect(rows[1].categoryId).toBe('c-dairy')
  })

  it('parses raw rows without headers sequentially', () => {
    const rawData = 'Ghee 1kg, 650, 520, 15\nButter 500g, 280, 230, 10'
    const rows = parsePastedProductText(rawData, MOCK_UNITS, MOCK_CATEGORIES, 'u-pcs')
    expect(rows).toHaveLength(2)

    expect(rows[0].name).toBe('Ghee 1kg')
    expect(rows[0].salePrice).toBe('650')
    expect(rows[0].purchasePrice).toBe('520')
    expect(rows[0].openingStock).toBe('15')
    expect(rows[0].unitId).toBe('u-pcs')
  })
})
