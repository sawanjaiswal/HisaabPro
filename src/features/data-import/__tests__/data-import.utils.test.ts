import { describe, it, expect } from 'vitest'
import {
  parseCsvText,
  autoDetectMappings,
  applyMappings,
  getTargetFields,
} from '../data-import.utils'

// ─── parseCsvText ─────────────────────────────────────────────────────────────

describe('parseCsvText', () => {
  it('parses CSV into headers and rows', () => {
    const csv = 'Name,Phone,Email\nRaju,9876543210,r@test.com\nPriya,8765432109,p@test.com'
    const result = parseCsvText(csv)
    expect(result.headers).toEqual(['Name', 'Phone', 'Email'])
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0].Name).toBe('Raju')
  })

  it('handles quoted fields with commas', () => {
    const csv = 'Name,Address\n"Sharma, Raju","12 Main St"'
    const result = parseCsvText(csv)
    expect(result.rows[0].Name).toBe('Sharma, Raju')
  })

  it('returns empty for header-only input', () => {
    expect(parseCsvText('Name,Phone').rows).toHaveLength(0)
  })

  it('returns empty for empty input', () => {
    const result = parseCsvText('')
    expect(result.headers).toHaveLength(0)
    expect(result.rows).toHaveLength(0)
  })
})

// ─── autoDetectMappings ───────────────────────────────────────────────────────

describe('autoDetectMappings', () => {
  it('maps known party column names', () => {
    const headers = ['Name', 'Phone', 'GSTIN', 'Random']
    const mappings = autoDetectMappings(headers, 'PARTIES')
    expect(mappings).toContainEqual({ sourceColumn: 'Name', targetField: 'name' })
    expect(mappings).toContainEqual({ sourceColumn: 'Phone', targetField: 'phone' })
    expect(mappings).toContainEqual({ sourceColumn: 'GSTIN', targetField: 'gstin' })
    expect(mappings.find((m) => m.sourceColumn === 'Random')).toBeUndefined()
  })

  it('maps known product column names', () => {
    const headers = ['Item Name', 'HSN Code', 'Selling Price']
    const mappings = autoDetectMappings(headers, 'PRODUCTS')
    expect(mappings).toContainEqual({ sourceColumn: 'Item Name', targetField: 'name' })
    expect(mappings).toContainEqual({ sourceColumn: 'HSN Code', targetField: 'hsn' })
    expect(mappings).toContainEqual({ sourceColumn: 'Selling Price', targetField: 'rate' })
  })

  it('returns empty for unrecognized headers', () => {
    const mappings = autoDetectMappings(['Foo', 'Bar'], 'PARTIES')
    expect(mappings).toHaveLength(0)
  })
})

// ─── applyMappings ────────────────────────────────────────────────────────────

describe('applyMappings', () => {
  it('maps source columns to target fields', () => {
    const rows = [{ 'Party Name': 'Raju', 'Mobile': '9876543210' }]
    const mappings = [
      { sourceColumn: 'Party Name', targetField: 'name' },
      { sourceColumn: 'Mobile', targetField: 'phone' },
    ]
    const result = applyMappings(rows, mappings)
    expect(result).toHaveLength(1)
    expect(result[0].mapped.name).toBe('Raju')
    expect(result[0].mapped.phone).toBe('9876543210')
    expect(result[0].isValid).toBe(true)
  })

  it('marks row invalid when name is missing', () => {
    const rows = [{ Phone: '9876543210' }]
    const mappings = [{ sourceColumn: 'Phone', targetField: 'phone' }]
    const result = applyMappings(rows, mappings)
    expect(result[0].isValid).toBe(false)
    expect(result[0].error).toBe('Missing name')
  })

  it('assigns sequential IDs', () => {
    const rows = [{ Name: 'A' }, { Name: 'B' }]
    const mappings = [{ sourceColumn: 'Name', targetField: 'name' }]
    const result = applyMappings(rows, mappings)
    expect(result[0].id).toBe('row-0')
    expect(result[1].id).toBe('row-1')
  })
})

// ─── getTargetFields ──────────────────────────────────────────────────────────

describe('getTargetFields', () => {
  it('returns party fields', () => {
    const fields = getTargetFields('PARTIES')
    expect(fields).toContain('name')
    expect(fields).toContain('phone')
    expect(fields).toContain('gstin')
  })

  it('returns product fields', () => {
    const fields = getTargetFields('PRODUCTS')
    expect(fields).toContain('name')
    expect(fields).toContain('hsn')
    expect(fields).toContain('barcode')
  })

  it('returns invoice fields', () => {
    const fields = getTargetFields('INVOICES')
    expect(fields).toContain('invoiceNumber')
    expect(fields).toContain('amount')
  })

  it('returns empty for unknown type', () => {
    expect(getTargetFields('UNKNOWN' as never)).toEqual([])
  })
})
